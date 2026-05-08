# Aegis Hosted — Phase 2 Behavior

## What Hosted Provides

Aegis Hosted is the fully managed version of Aegis DMS. Users manage their estate information, trusted contacts, and dead man's switch configuration through the Aegis SaaS web interface — no Docker, no self-hosted server, no technical setup required.

Phase 2 implements:
- Estate item CRUD with field-level encryption
- Contact CRUD with field-level encryption and priority ordering
- Switch CRUD, state machine, readiness checks, and arm/pause/cancel/check-in actions
- Hosted dashboard summary
- Billing portal access

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

## Phase 2 Limitations

Phase 2 supports hosted data management and switch scheduling. The following are explicitly **not implemented in Phase 2** and will be added in Phase 3:

- Managed packet generation (assembling estate items into an encrypted release packet)
- Managed R2/S3 packet storage
- Hosted packet download by contacts
- Full contact cascade (notify → verify → accept → download → acknowledge)
- Relay Escrow release execution
- Claim portal release flow

When a hosted switch reaches `triggered` in Phase 2, a release run record is created but no packets are generated and no contacts are notified. The state is a clean handoff point for Phase 3.

The UI shows a disclosure where relevant:

> Phase 2 supports switch scheduling, reminders, and trigger-state tracking. Managed packet release and contact cascade are added in the next phase.

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

## API Routes

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
```
