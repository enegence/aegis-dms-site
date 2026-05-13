# Aegis Hosted — Phase 3 Behavior

## What Hosted Provides

Aegis Hosted is the fully managed version of Aegis DMS. Users manage their estate information, trusted contacts, and dead man's switch configuration through the Aegis SaaS web interface — no Docker, no self-hosted server, no technical setup required.

Phase 3 implements (in addition to Phase 2):
- Estate item CRUD with field-level encryption
- Contact CRUD with field-level encryption and priority ordering
- Switch CRUD, state machine, readiness checks, and arm/pause/cancel/check-in actions
- Hosted dashboard summary and billing portal
- Managed R2/S3 packet generation and storage
- Hosted notification dispatch (Postmark + Telegram)
- Hosted contact cascade on trigger
- Claim portal for contacts to receive released packets
- Relay Escrow material model (explicit trust layer)

## Data Management

### Estate Items

Each estate item belongs to a single user (user-scoped). The `category` and `title` fields stay plaintext for display and filtering. All other sensitive fields are encrypted at rest before storage:

| API field | DB column |
|---|---|
| `institutionName` | `institutionNameEncrypted` |
| `accountType` | `accountTypeEncrypted` |
| `referenceHint` | `referenceHintEncrypted` |
| `assetDescription` | `assetDescriptionEncrypted` |
| `locationNotes` | `locationNotesEncrypted` |
| `executorNotes` | `executorNotesEncrypted` |

The API always returns decrypted domain values. Encrypted blobs are never sent to the web client.

### Contacts

Each contact belongs to a single user. All identifying fields are encrypted at rest:

| API field | DB column |
|---|---|
| `fullName` | `fullNameEncrypted` |
| `relationship` | `relationshipEncrypted` |
| `email` | `emailEncrypted` |
| `phone` | `phoneEncrypted` |
| `telegramHandle` | `telegramHandleEncrypted` |
| `backupNotes` | `backupNotesEncrypted` |

Contacts support a `priority` ordering. The `POST /api/contacts/reorder` endpoint accepts an ordered list of contact IDs; the server validates all IDs belong to the requesting user before updating order.

## Switch Modes and State Machine

Hosted switches support two trigger modes:

- **Trip mode** — triggers at a specified `triggerAt` date/time.
- **Heartbeat mode** — triggers if the user misses check-ins beyond `heartbeatIntervalDays` + grace period.

### States

```
draft → armed → warning → triggered
               ↓         ↓
             paused    cancelled
                         ↓
                       completed
```

- `draft` — created, not yet armed
- `armed` — actively tracking
- `warning` — trigger window approaching; warning notifications sent
- `triggered` — trigger condition met; release run created
- `paused` — temporarily suspended
- `cancelled` — permanently stopped
- `completed` — release run has finished (Phase 3)

### Actions

| Route | Effect |
|---|---|
| `POST /api/switches/:id/arm` | Validates readiness, transitions `draft` → `armed` |
| `POST /api/switches/:id/pause` | Transitions `armed` or `warning` → `paused` |
| `POST /api/switches/:id/cancel` | Marks switch `cancelled` |
| `POST /api/switches/:id/check-in` | Resets `nextCheckInDueAt` in heartbeat mode |
| `POST /api/switches/:id/evaluate` | Manually triggers state evaluation (dev/testing) |

### Release Run Constraint

Only one active release run per user is allowed at a time. A switch cannot be triggered if the user already has an active `release_runs` record. This prevents parallel cascades to the same contacts.

When a hosted switch reaches `triggered`, a release run record is created with status `active_pending_packet` as a handoff point for Phase 3 packet/cascade work.

## Readiness Checks

The following conditions must all be true before a switch can be armed (`GET /api/switches/:id/readiness`):

1. User's email is verified
2. Subscription is active or trialing (or alpha mode is enabled)
3. At least one contact is selected for the switch
4. At least one estate item is selected for the switch
5. Switch has a valid schedule (trigger date for trip mode, interval for heartbeat mode)
6. Hosted trust acknowledgement exists (when required)
7. Notification service is available
8. Packet/storage readiness (Phase 2 returns a warning placeholder; Phase 3 enforces this fully)

The readiness response enumerates which checks passed and failed, allowing the UI to show a checklist.

## Phase 3: Packet Generation and Cascade

### Managed Storage

Hosted packets are encrypted with AES-256-GCM using a per-packet key. The packet key itself is encrypted with the user's master key (HKDF-derived). Encrypted packets are uploaded to R2/S3-compatible managed storage. Only the packet metadata (hash, storage key, version) is retained in PostgreSQL; the plaintext estate data is never written to the database.

Users can generate packets manually via the Release page or from a switch detail view. The worker also generates packets automatically when a release run starts.

### Hosted Contact Cascade

When a switch is triggered, the hosted worker creates a release run and starts the contact cascade:

1. The first-priority contact receives a notification (email and/or Telegram).
2. The contact follows a claim portal link to verify identity, accept the release, and download the packet.
3. If the contact does not respond within the configured window, the next contact is escalated to.
4. The cascade continues until a contact acknowledges or all contacts are exhausted.

Each step is tracked in `contact_claims`. The release run completes when a claim is acknowledged.

### Claim Portal

The claim portal is a public web flow (no account required). Contacts access it via a one-time token link. The flow:

1. **Landing** — acknowledges the claim and prompts the contact to open it.
2. **Verify** — optional PIN verification if configured.
3. **Accept** — explicit acceptance before packet access is granted.
4. **Download** — downloads the encrypted packet from managed storage.
5. **Acknowledge** — final confirmation that the contact received the packet.

The claim token is hashed before storage (`claimTokenHash`). The plaintext token is never stored server-side.

### Release Page

Users can view their packet history, active release runs, and cascade status at `/release`. Available actions:

- **Verify packet** — confirms the packet still exists in managed storage.
- **Cancel release run** — stops an active cascade (for testing or error recovery).

## Trust Model

Aegis Hosted v1 uses **server-side encryption** with server-managed keys. HKDF key derivation is used to derive per-record encryption keys from the master key.

What this means:
- Sensitive fields are encrypted before storage and decrypted by the server on retrieval.
- The server holds the master key. Users must trust Aegis SaaS to protect their data.
- There is **no zero-knowledge claim** for Hosted v1. A compromised Aegis server could access plaintext data.
- Aegis Hosted is not a substitute for personal local encryption if you require zero server trust.

This is disclosed to users during onboarding and on the estate/contacts screens:

> Sensitive estate and contact details are encrypted at rest. Aegis Hosted is a managed service and requires trusting Aegis SaaS with server-side encryption for v1.

Shamir Secret Sharing and multi-party key management are not implemented in the alpha. These may be explored in future versions.

## Phase 3 API Routes

All hosted CRUD routes require browser auth + CSRF on state-changing requests:

```
GET    /api/estate-items
GET    /api/estate-items/:id
POST   /api/estate-items
PUT    /api/estate-items/:id
DELETE /api/estate-items/:id

GET    /api/contacts
GET    /api/contacts/:id
POST   /api/contacts
PUT    /api/contacts/:id
DELETE /api/contacts/:id
POST   /api/contacts/reorder

GET    /api/switches
GET    /api/switches/:id
POST   /api/switches
PUT    /api/switches/:id
DELETE /api/switches/:id
GET    /api/switches/:id/readiness
POST   /api/switches/:id/arm
POST   /api/switches/:id/pause
POST   /api/switches/:id/cancel
POST   /api/switches/:id/check-in

GET    /api/dashboard

GET    /api/app/packets
GET    /api/app/packets/:id
POST   /api/app/switches/:id/packets/generate
POST   /api/app/packets/:id/verify
DELETE /api/app/packets/:id

GET    /api/app/release-runs
POST   /api/app/release-runs/:id/cancel

GET    /api/claim/:token
POST   /api/claim/:token/open
POST   /api/claim/:token/verify
POST   /api/claim/:token/accept
GET    /api/claim/:token/packet
POST   /api/claim/:token/key-view
POST   /api/claim/:token/acknowledge
```
