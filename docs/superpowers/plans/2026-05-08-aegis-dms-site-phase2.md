# Aegis DMS Site — Phase 2: Core Domain Logic

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the core runtime behavior for the commercial Aegis DMS Site: Relay heartbeat API, Relay connection management, Relay offline monitor and alerts, hosted estate/contact/switch CRUD, hosted switch readiness/actions, app dashboard, marketing/pricing pages, and billing portal access — all with tests.

**Architecture:** Continue from Phase 1. The repo is a monorepo with `server/` (Fastify + Drizzle + PostgreSQL), `web/` (React + Vite + Tailwind), `packages/shared/`, and `packages/contracts/`. Phase 2 must support both commercial functions of the SaaS platform: **Aegis Relay** for self-hosted users and **Aegis Hosted** for fully managed users. Phase 2 should not implement managed packet storage, hosted packet generation, release-key display, full contact cascade, or Relay Escrow release execution; those are Phase 3. It should, however, create clean service boundaries so Phase 3 can add packet/cascade behavior without rewriting Relay or Hosted CRUD.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, PostgreSQL, React 18, Vite, Tailwind CSS, Vitest, Argon2, Stripe, Postmark, `packages/contracts`, Docker.

**Parent plan:** `2026-05-06-aegis-master-plan.md`

**Target repo:** `aegis-dms-site/`

> **Note on phase labels:** Phase labels are sequencing guidance, not fixed delivery estimates. Optimize for correctness, security, and coherent architecture over calendar targets.

---

## Pre-requisites

Before starting, the engineer needs:

- SaaS Phase 1 completed and merged to `main`.
- Auth/register/login/email verification/password reset/session flow working.
- CSRF protection working.
- Stripe checkout, webhook, subscription lifecycle, and pricing API working.
- Postmark email service exists.
- `packages/contracts` exists and is compatible with OSS contracts.
- PostgreSQL schema contains encrypted estate/contact fields, `release_runs`, `trust_acknowledgements`, `relay_connections`, `subscriptions`, `audit_events`, and required auth/billing tables.
- All state-changing authenticated routes must require auth + CSRF.
- Relay heartbeat routes that use API keys must not require browser CSRF, but must require hashed API key verification and strict validation.

---

## Phase 2 Scope Boundary

### In Scope

- Relay connection CRUD for authenticated SaaS users.
- Relay API key generation, hashing, one-time display, rotation, and revocation.
- Relay heartbeat endpoint using `packages/contracts` heartbeat schema.
- Relay status endpoint.
- Relay monitor worker for missed heartbeats/offline detection.
- Relay alert email dispatch via Postmark.
- Hosted estate CRUD with encrypted sensitive fields.
- Hosted contact CRUD with encrypted sensitive fields.
- Hosted switch CRUD/actions/readiness.
- Basic hosted switch state machine through warning/triggered states.
- Hosted app dashboard.
- Marketing landing page.
- Pricing page with live pricing API.
- Billing portal route/page.
- Audit events with redacted metadata.

### Explicitly Out of Scope Until Phase 3

- Managed packet builder.
- Managed R2/S3 packet storage.
- Hosted packet download.
- Claim portal release flow.
- Full contact cascade.
- Relay Escrow key/material release execution.
- DeadDrop public partner API.
- Admin analytics beyond what already exists.

---

## Task 1: Verify and Extend Phase 1 Schema for Phase 2

**Goal:** Ensure database schema supports Relay, Hosted CRUD, switch runtime behavior, notification events, and audit-safe operations.

**Files:**

- Update: `server/src/db/schema.ts`
- Update/Create: `server/drizzle/*.sql`
- Test: `server/tests/schema-phase2.test.ts`

- [ ] **Step 1: Review required existing tables**

Confirm these tables exist:

```text
users
sessions
email verification/reset fields
subscriptions
stripe_webhook_events
relay_connections
estate_items
contacts
switches
packets
contact_claims
release_runs
trust_acknowledgements
audit_events
```

- [ ] **Step 2: Confirm SaaS sensitive fields are encrypted**

Estate sensitive fields must be encrypted:

```text
institutionNameEncrypted
accountTypeEncrypted
referenceHintEncrypted
assetDescriptionEncrypted
locationNotesEncrypted
executorNotesEncrypted
```

Contact sensitive fields must be encrypted:

```text
fullNameEncrypted
relationshipEncrypted
emailEncrypted
phoneEncrypted
telegramHandleEncrypted
backupNotesEncrypted
```

Do not proceed if Phase 1 left plaintext versions of those fields.

- [ ] **Step 3: Extend relay connections**

Confirm/add fields:

```typescript
label
apiKeyHash
status // active | offline | disconnected
lastHeartbeatAt
lastHeartbeatData
lastExpectedHeartbeatAt
offlineAlertSentAt   // use this; do NOT add separate alertEmailSentAt
mode // relay_monitoring | relay_escrow_future
createdAt
updatedAt
revokedAt
```

For Phase 2, only `relay_monitoring` behavior is required. `relay_escrow_future` can be rejected or disabled until Phase 3.

- [ ] **Step 4: Add notification events table if missing**

```typescript
export const notificationEvents = pgTable('notification_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  relayConnectionId: uuid('relay_connection_id').references(() => relayConnections.id),
  switchId: uuid('switch_id').references(() => switches.id),
  contactId: uuid('contact_id').references(() => contacts.id),
  channel: text('channel').notNull(),
  purpose: text('purpose').notNull(),
  status: text('status').notNull(),
  externalId: text('external_id'),
  failureReason: text('failure_reason'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

- [ ] **Step 5: Add hosted switch runtime fields if missing**

The `switches` table should support:

```text
mode
status
triggerAt
heartbeatIntervalDays
nextCheckInDueAt
warningStartsAt
gracePeriodHours
warningWindowDays
lastCheckInAt
lastReminderSentAt
lastWarningSentAt
lastEvaluatedAt
selectedContactIds
selectedEstateItemIds
```

- [ ] **Step 6: Write schema tests**

Test:

- migrations run on blank DB;
- required Relay fields exist;
- estate/contact sensitive columns use encrypted names;
- `release_runs` exists;
- `trust_acknowledgements` exists;
- `notification_events` exists.

- [ ] **Step 7: Update test setup truncation list**

Add `notification_events` to the TRUNCATE in `server/tests/setup.ts`:

```typescript
await client`TRUNCATE users, sessions, subscriptions, relay_connections, stripe_webhook_events, estate_items, contacts, switches, audit_events, encryption_keys, trust_acknowledgements, notification_events CASCADE`;
```

- [ ] **Step 8: Commit**

```bash
git add server/src/db server/drizzle server/tests/schema-phase2.test.ts server/tests/setup.ts
git commit -m "feat: extend saas schema for relay and hosted domain logic"
```

---

## Task 2: Update Shared Types and API Schemas

**Goal:** Add typed request/response schemas for Relay, Hosted estate/contact/switches, dashboard, and billing portal.

**Files:**

- Update: `packages/shared/src/types.ts`
- Create: `server/src/schemas/relay.ts`
- Create: `server/src/schemas/estate.ts`
- Create: `server/src/schemas/contacts.ts`
- Create: `server/src/schemas/switches.ts`
- Create: `server/src/schemas/dashboard.ts`
- Test: `server/tests/schemas-phase2.test.ts`

- [x] **Step 1: Add Relay shared types**

```typescript
export type RelayConnectionStatus = 'active' | 'offline' | 'disconnected';

export interface RelayConnection {
  id: string;
  label: string | null;
  lastHeartbeatAt: string | null;
  lastExpectedHeartbeatAt: string | null;
  status: RelayConnectionStatus;
  createdAt: string;
}
```

- [x] **Step 2: Add hosted domain types**

Add or confirm:

```text
EstateItem
Contact
Switch
ReadinessCheck
SwitchReadiness
DashboardSummary
```

Use UUID string IDs in SaaS shared types.

- [x] **Step 3: Create zod schemas**

Schemas needed:

```text
CreateRelayConnectionInput
UpdateRelayConnectionInput
RelayHeartbeatInput
CreateEstateItemInput
UpdateEstateItemInput
CreateContactInput
UpdateContactInput
CreateSwitchInput
UpdateSwitchInput
ArmSwitchInput
CheckInInput
DashboardResponse
```

- [x] **Step 4: Use contracts for heartbeat validation** <!-- DEVIATION: heartbeat route not yet implemented; schema deferred to Task 5/6 where the relay API routes are built -->

`POST /api/relay/heartbeat` must parse the request using `HeartbeatRequestSchema` from `packages/contracts` before any DB updates.

- [x] **Step 5: Add tests**

Test valid/invalid Relay heartbeat, switch validation, encrypted-domain input validation, dashboard output shape.

- [x] **Step 6: Commit**

```bash
git add packages/shared/src/types.ts server/src/schemas server/tests/schemas-phase2.test.ts
git commit -m "feat: add phase two saas domain schemas"
```

---

## Task 3: Implement Redacted Audit Service

**Goal:** Provide a reusable audit service for Relay and Hosted domain operations.

**Files:**

- Create: `server/src/services/audit.ts`
- Test: `server/tests/audit.test.ts`

- [ ] **Step 1: Create audit writer**

```typescript
export interface AuditInput {
  userId?: string | null;
  switchId?: string | null;
  releaseRunId?: string | null;
  relayConnectionId?: string | null;
  eventType: string;
  actorType: 'user' | 'system' | 'relay' | 'contact' | 'admin';
  actorId?: string | null;
  metadata?: Record<string, unknown> | null;
}
```

- [ ] **Step 2: Sanitize metadata**

Reject or redact keys containing:

```text
email
phone
name
institution
account
password
secret
token
apiKey
keyMaterial
plaintext
executorNotes
stripeSecret
```

- [ ] **Step 3: Add tests**

Test write, query, redaction/rejection, and no plaintext PII.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/audit.ts server/tests/audit.test.ts
git commit -m "feat: add saas audit service"
```

---

## Task 4: Implement Field Encryption Domain Helpers

**Goal:** Ensure Hosted CRUD encrypts/decrypts estate/contact fields consistently and never exposes encrypted blobs to the web app.

**Files:**

- Create/Update: `server/src/services/field-encrypt.ts`
- Create: `server/src/services/estate-mapper.ts`
- Create: `server/src/services/contact-mapper.ts`
- Test: `server/tests/field-encryption-domain.test.ts`

- [ ] **Step 1: Confirm encryption service**

Use AES-256-GCM field encryption from Phase 1. If the Phase 1 service only exists for secrets, extend it safely for domain field encryption.

- [ ] **Step 2: Create estate mapper**

Map API input/output to encrypted DB fields:

```text
institutionName <-> institutionNameEncrypted
accountType <-> accountTypeEncrypted
referenceHint <-> referenceHintEncrypted
assetDescription <-> assetDescriptionEncrypted
locationNotes <-> locationNotesEncrypted
executorNotes <-> executorNotesEncrypted
```

- [ ] **Step 3: Create contact mapper**

Map:

```text
fullName <-> fullNameEncrypted
relationship <-> relationshipEncrypted
email <-> emailEncrypted
phone <-> phoneEncrypted
telegramHandle <-> telegramHandleEncrypted
backupNotes <-> backupNotesEncrypted
```

- [ ] **Step 4: Add tests**

Test:

- plaintext stored encrypted;
- API output returns decrypted domain values;
- DB never stores sensitive plaintext;
- wrong key fails safely;
- empty optional fields stay null.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/field-encrypt.ts server/src/services/estate-mapper.ts server/src/services/contact-mapper.ts server/tests/field-encryption-domain.test.ts
git commit -m "feat: add encrypted domain mappers"
```

---

## Task 5: Implement Relay Connection Management

**Goal:** Let authenticated SaaS users create, list, rotate, and revoke Relay connections for self-hosted Aegis Core instances.

**Files:**

- Create: `server/src/services/relay-connections.ts`
- Create/Update: `server/src/routes/relay.ts`
- Update: `server/src/index.ts`
- Test: `server/tests/relay-connections.test.ts`

- [ ] **Step 1: Implement API key generation and hashing**

Rules:

```text
Generate high-entropy API key.
Display raw API key only once at creation/rotation.
Store only SHA-256 or HMAC-SHA-256 hash.
Do not log API key.
Do not include API key in audit metadata.
```

- [ ] **Step 2: Implement authenticated Relay connection routes**

Routes:

```text
GET    /api/relay/connections
POST   /api/relay/connections
GET    /api/relay/connections/:id
PATCH  /api/relay/connections/:id
POST   /api/relay/connections/:id/rotate-key
POST   /api/relay/connections/:id/revoke
DELETE /api/relay/connections/:id
```

Notes:

- Auth + CSRF required.
- Delete can hard-delete only if no release history exists; otherwise revoke/disconnect.

- [ ] **Step 3: Add subscription gating placeholder**

If billing/subscriptions are already implemented, require Relay or Hosted subscription for active Relay connections. If subscription gating is not stable yet, add a clear TODO and central helper in `server/src/services/subscription-gate.ts`:

```typescript
// server/src/services/subscription-gate.ts
export async function canUseRelay(db: AegisDb, userId: string): Promise<boolean>;
export async function canUseHosted(db: AegisDb, userId: string): Promise<boolean>;
```

- [ ] **Step 4: Add audit events**

Events:

```text
relay_connection_created
relay_connection_updated
relay_key_rotated
relay_connection_revoked
relay_connection_deleted
```

- [ ] **Step 5: Add tests**

Test:

- create returns raw API key once;
- stored DB value is hash only;
- list never returns API key;
- rotate invalidates old key;
- revoke prevents heartbeat acceptance;
- CSRF/auth required for management routes.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/relay-connections.ts server/src/routes/relay.ts server/src/index.ts server/tests/relay-connections.test.ts
git commit -m "feat: add relay connection management"
```

---

## Task 6: Implement Relay Heartbeat API

**Goal:** Allow self-hosted Aegis Core instances to send heartbeats to SaaS using Relay API keys.

**Files:**

- Update: `server/src/routes/relay.ts`
- Create: `server/src/services/relay-auth.ts`
- Create: `server/src/services/relay-heartbeats.ts`
- Test: `server/tests/relay-heartbeat.test.ts`

- [ ] **Step 1: Implement Relay API-key auth**

Support:

```text
Authorization: Bearer <relay_api_key>
```

Rules:

- Hash incoming key and compare against stored hash.
- Reject revoked/disconnected connections.
- Rate limit heartbeat endpoint by key/IP.
- Do not require browser CSRF for API-key heartbeat route.

- [ ] **Step 2: Implement heartbeat endpoint**

Route:

```text
POST /api/relay/heartbeat
```

Input must validate against `HeartbeatSchema` from `packages/contracts`.

Store:

```text
lastHeartbeatAt
lastExpectedHeartbeatAt
lastHeartbeatData
status = active
```

- [ ] **Step 3: Implement status endpoint**

Route:

```text
GET /api/relay/status
```

Authenticated by API key. Returns:

```typescript
{
  accepted: true,
  serverTimestamp: string,
  status: 'active' | 'offline' | 'disconnected',
  lastHeartbeatAt: string | null,
  nextExpectedAt: string | null
}
```

- [ ] **Step 4: Add audit events**

Audit `relay_heartbeat_received` with no sensitive payload.

Do not log full heartbeat metadata if it includes owner-local URLs or sensitive local config.

- [ ] **Step 5: Add tests**

Test:

- valid API key accepted;
- invalid API key rejected;
- revoked connection rejected;
- malformed heartbeat rejected;
- contract schema validates;
- `lastHeartbeatAt` updates;
- status flips back to active after offline.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/relay-auth.ts server/src/services/relay-heartbeats.ts server/src/routes/relay.ts server/tests/relay-heartbeat.test.ts
git commit -m "feat: add relay heartbeat api"
```

---

## Task 7: Implement Relay Monitor Worker

**Goal:** Detect missed Relay heartbeats and send owner alerts via Postmark.

**Files:**

- Create: `server/src/worker/index.ts`
- Create: `server/src/services/relay-monitor.ts`
- Create: `server/src/services/notification-events.ts`
- Update: `server/src/index.ts` if worker starts with API process in dev
- Test: `server/tests/relay-monitor.test.ts`

- [ ] **Step 1: Implement monitor logic**

For each active Relay connection:

```text
If now > lastExpectedHeartbeatAt + grace window:
  mark status offline
  send alert if not already sent recently
  write audit event
```

Define default grace:

```text
AEGIS_RELAY_OFFLINE_GRACE_MINUTES=10
```

- [ ] **Step 2: Implement alert email**

Use Postmark service from Phase 1.

Template:

```text
Subject: Aegis Relay has not heard from your self-hosted instance
Body: Your Aegis Core instance missed its expected heartbeat. Relay Monitoring increases awareness, but final release may still depend on your local host unless Relay Escrow is configured.
```

No sensitive estate/contact data.

- [ ] **Step 3: Prevent alert spam**

Use `offlineAlertSentAt` / `notification_events` to avoid repeated messages every worker tick.

- [ ] **Step 4: Add worker runner**

```typescript
export async function runRelayMonitorOnce(now?: Date): Promise<RelayMonitorResult>;
export function startWorker(options?: WorkerOptions): { stop(): Promise<void> };
```

Env:

```text
AEGIS_WORKER_ENABLED=true
AEGIS_WORKER_INTERVAL_SECONDS=60
```

- [ ] **Step 5: Add tests**

Test:

- active connection stays active before expected time;
- overdue connection becomes offline;
- alert sent once;
- recovered heartbeat sets active;
- revoked/disconnected ignored;
- audit metadata redacted.

- [ ] **Step 6: Commit**

```bash
git add server/src/worker server/src/services/relay-monitor.ts server/src/services/notification-events.ts server/tests/relay-monitor.test.ts
git commit -m "feat: add relay offline monitor"
```

---

## Task 8: Implement Hosted Estate Item CRUD

**Goal:** Add authenticated, user-scoped Hosted estate item CRUD using encrypted sensitive fields.

**Files:**

- Create: `server/src/services/estate.ts`
- Replace: `server/src/routes/estate-items.ts` (stub exists — replace with full implementation; keep same filename for import compatibility)
- Update: `server/src/index.ts` (already imports `estateItemRoutes` from `estate-items.ts` — no change needed)
- Test: `server/tests/estate.test.ts`

- [ ] **Step 1: Implement estate service**

Methods:

```typescript
listEstateItems(userId)
getEstateItem(userId, id)
createEstateItem(userId, input)
updateEstateItem(userId, id, input)
deleteEstateItem(userId, id)
```

- [ ] **Step 2: Encrypt sensitive fields**

Use mapper from Task 4. Do not store plaintext sensitive fields.

- [ ] **Step 3: Implement routes**

```text
GET    /api/estate-items
GET    /api/estate-items/:id
POST   /api/estate-items
PUT    /api/estate-items/:id
DELETE /api/estate-items/:id
```

Auth + CSRF for state-changing routes.

- [ ] **Step 4: Add tests**

Test:

- user scoping prevents cross-user access;
- create stores encrypted DB values;
- list returns decrypted domain values;
- update preserves encryption;
- delete works;
- audit events contain no PII.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/estate.ts server/src/routes/estate.ts server/src/index.ts server/tests/estate.test.ts
git commit -m "feat: add hosted estate item crud"
```

---

## Task 9: Implement Hosted Contact CRUD

**Goal:** Add authenticated, user-scoped Hosted contact CRUD with encrypted sensitive fields and priority ordering.

**Files:**

- Create: `server/src/services/contacts.ts`
- Create: `server/src/routes/contacts.ts`
- Update: `server/src/index.ts`
- Test: `server/tests/contacts.test.ts`

- [ ] **Step 1: Implement contact service**

Methods:

```typescript
listContacts(userId)
getContact(userId, id)
createContact(userId, input)
updateContact(userId, id, input)
deleteContact(userId, id)
reorderContacts(userId, orderedIds)
```

- [ ] **Step 2: Encrypt sensitive fields**

Use contact mapper. Never store plaintext names/emails/phones/Telegram handles.

- [ ] **Step 3: Implement routes**

```text
GET    /api/contacts
GET    /api/contacts/:id
POST   /api/contacts
PUT    /api/contacts/:id
DELETE /api/contacts/:id
POST   /api/contacts/reorder
```

- [ ] **Step 4: Add tests**

Test:

- user scoping;
- priority ordering;
- encrypted DB values;
- decrypted API output;
- reorder validation rejects missing/foreign IDs;
- audit metadata redacted.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/contacts.ts server/src/routes/contacts.ts server/src/index.ts server/tests/contacts.test.ts
git commit -m "feat: add hosted contact crud"
```

---

## Task 10: Implement Hosted Switch Repository and State Machine

**Goal:** Add user-scoped switch persistence and basic state-machine behavior for Aegis Hosted.

**Files:**

- Create: `server/src/services/switch-repository.ts`
- Create: `server/src/services/switch-engine.ts`
- Create: `server/src/services/readiness.ts`
- Test: `server/tests/switch-engine.test.ts`
- Test: `server/tests/readiness.test.ts`

- [ ] **Step 1: Implement switch repository**

Methods:

```typescript
listSwitches(userId)
getSwitch(userId, switchId)
createSwitch(userId, input)
updateSwitch(userId, switchId, input)
deleteSwitch(userId, switchId)
getActiveReleaseRun(userId)
createReleaseRun(userId, input)
markSwitchStatus(userId, switchId, status, patch)
```

- [ ] **Step 2: Implement hosted state machine**

Support:

```text
trip mode
heartbeat mode
armed -> warning -> triggered
pause
cancel
check-in
release-run constraint
```

Do not implement packet/cascade in Phase 2. Triggered hosted switches should create a release run with `active_pending_packet` or equivalent status for Phase 3 handoff.

- [ ] **Step 3: Implement readiness service**

Readiness checks:

```text
subscription active or trialing
email verified
at least one contact selected
at least one estate item selected
valid schedule
hosted trust acknowledgement exists when required
notification service available
packet/storage readiness placeholder warning for Phase 3
```

- [ ] **Step 4: Add tests**

Test:

- trip schedule transitions;
- heartbeat check-in reset;
- user scoping;
- readiness fails without contacts/items;
- release-run constraint prevents duplicate cascades;
- triggered state creates/attaches release run;
- audit metadata redacted.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/switch-repository.ts server/src/services/switch-engine.ts server/src/services/readiness.ts server/tests/switch-engine.test.ts server/tests/readiness.test.ts
git commit -m "feat: add hosted switch engine and readiness"
```

---

## Task 11: Implement Hosted Switch API Routes

**Goal:** Expose authenticated, user-scoped switch CRUD/action endpoints for Hosted users.

**Files:**

- Create: `server/src/routes/switches.ts`
- Update: `server/src/index.ts`
- Test: `server/tests/switches.test.ts`

- [ ] **Step 1: Implement CRUD routes**

```text
GET    /api/switches
GET    /api/switches/:id
POST   /api/switches
PUT    /api/switches/:id
DELETE /api/switches/:id
```

- [ ] **Step 2: Implement action routes**

```text
GET  /api/switches/:id/readiness
POST /api/switches/:id/arm
POST /api/switches/:id/pause
POST /api/switches/:id/cancel
POST /api/switches/:id/check-in
POST /api/switches/:id/evaluate
```

- [ ] **Step 3: Apply auth/security**

Rules:

- Auth required.
- CSRF required on state-changing browser routes.
- Email verification required for arming.
- Subscription/trial policy enforced through a central helper.

- [ ] **Step 4: Add tests**

Test CRUD, action routes, readiness failures, CSRF, cross-user isolation, and audit events.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/switches.ts server/src/index.ts server/tests/switches.test.ts
git commit -m "feat: add hosted switch api"
```

---

## Task 12: Implement Hosted Dashboard API

**Goal:** Provide authenticated dashboard summary for hosted users.

**Files:**

- Create: `server/src/routes/dashboard.ts`
- Update: `server/src/index.ts`
- Test: `server/tests/dashboard.test.ts`

- [ ] **Step 1: Implement route**

```text
GET /api/dashboard
```

Response:

```typescript
interface HostedDashboardSummary {
  user: { displayName: string; emailVerified: boolean };
  subscription: { plan: string | null; status: string | null };
  estateItemCount: number;
  contactCount: number;
  activeSwitchCount: number;
  warningSwitchCount: number;
  triggeredSwitchCount: number;
  relayConnectionCount: number;
  offlineRelayConnectionCount: number;
  nextSwitch: Switch | null;
  nextActionAt: string | null;
}
```

- [ ] **Step 2: Add tests**

Test empty dashboard, with hosted data, with relay connections, and cross-user isolation.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/dashboard.ts server/src/index.ts server/tests/dashboard.test.ts
git commit -m "feat: add hosted dashboard api"
```

---

## Task 13: Implement Billing Portal Route

**Goal:** Let authenticated users open Stripe Customer Portal for subscription management.

**Files:**

- Update: `server/src/routes/billing.ts`
- Update: `server/src/services/stripe.ts`
- Test: `server/tests/billing-portal.test.ts`

- [ ] **Step 1: Add portal helper**

```typescript
createBillingPortalSession(userId, returnUrl): Promise<{ url: string }>;
```

- [ ] **Step 2: Add route**

```text
POST /api/billing/portal
```

Auth + CSRF required.

- [ ] **Step 3: Add tests**

Mock Stripe. Test:

- auth required;
- CSRF required;
- missing customer creates useful error;
- portal URL returned;
- no Stripe secrets leaked.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/billing.ts server/src/services/stripe.ts server/tests/billing-portal.test.ts
git commit -m "feat: add stripe billing portal route"
```

---

## Task 14: Implement Frontend API Client Updates

**Goal:** Add typed frontend helpers for Relay, Hosted CRUD, switches, dashboard, and billing portal.

**Files:**

- Update: `web/src/lib/api.ts`
- Create: `web/src/lib/relay.ts`
- Create: `web/src/lib/estate.ts`
- Create: `web/src/lib/contacts.ts`
- Create: `web/src/lib/switches.ts`
- Create: `web/src/lib/dashboard.ts`
- Create: `web/src/lib/billing.ts`

- [ ] **Step 1: Add Relay helpers**

```typescript
listRelayConnections()
createRelayConnection(input)
rotateRelayKey(id)
revokeRelayConnection(id)
deleteRelayConnection(id)
```

- [ ] **Step 2: Add Hosted CRUD helpers**

```typescript
listEstateItems()
createEstateItem(input)
updateEstateItem(id, input)
deleteEstateItem(id)
listContacts()
createContact(input)
updateContact(id, input)
deleteContact(id)
reorderContacts(ids)
```

- [ ] **Step 3: Add switch/dashboard/billing helpers**

```typescript
listSwitches()
createSwitch(input)
getSwitchReadiness(id)
armSwitch(id)
pauseSwitch(id)
cancelSwitch(id)
checkInSwitch(id)
getDashboard()
openBillingPortal()
```

- [ ] **Step 4: Preserve CSRF behavior**

All browser state-changing requests must use CSRF-enabled API wrapper.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib
git commit -m "feat: add phase two frontend api clients"
```

---

## Task 15: Implement App Dashboard UI

**Goal:** Replace placeholder authenticated app dashboard with usable Hosted/Relay overview.

**Files:**

- Create/Update: `web/src/pages/app/Dashboard.tsx`
- Create: `web/src/components/dashboard/SubscriptionCard.tsx`
- Create: `web/src/components/dashboard/HostedSummaryCards.tsx`
- Create: `web/src/components/dashboard/RelayStatusCard.tsx`
- Create: `web/src/components/dashboard/CountdownCard.tsx`
- Update: `web/src/App.tsx`

- [ ] **Step 1: Fetch dashboard summary**

Use `GET /api/dashboard`.

- [ ] **Step 2: Show hosted summary**

Show estate items, contacts, active switches, warning switches, triggered switches.

- [ ] **Step 3: Show Relay summary**

Show active/offline/disconnected Relay connections.

- [ ] **Step 4: Show subscription status**

Show plan/status and link to billing portal.

- [ ] **Step 5: Add empty states**

Prompt user to:

```text
add estate items
add trusted contacts
create first switch
connect self-hosted Relay instance
```

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/app/Dashboard.tsx web/src/components/dashboard web/src/App.tsx
git commit -m "feat: add hosted app dashboard"
```

---

## Task 16: Implement Hosted Estate and Contact UI

**Goal:** Provide basic hosted data-management screens.

**Files:**

- Create: `web/src/pages/app/Estate.tsx`
- Create: `web/src/pages/app/Contacts.tsx`
- Create: `web/src/components/estate/EstateItemForm.tsx`
- Create: `web/src/components/estate/EstateItemCard.tsx`
- Create: `web/src/components/contacts/ContactForm.tsx`
- Create: `web/src/components/contacts/ContactCard.tsx`
- Update: `web/src/App.tsx`

- [ ] **Step 1: Estate UI**

Support list/create/edit/delete.

Do not display scary/legal copy yet beyond basic disclaimers.

- [ ] **Step 2: Contact UI**

Support list/create/edit/delete/reorder.

- [ ] **Step 3: UX privacy copy**

Add brief note:

```text
Sensitive estate and contact details are encrypted at rest. Aegis Hosted is a managed service and requires trusting Aegis SaaS with server-side encryption for v1.
```

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/app/Estate.tsx web/src/pages/app/Contacts.tsx web/src/components/estate web/src/components/contacts web/src/App.tsx
git commit -m "feat: add hosted estate and contacts ui"
```

---

## Task 17: Implement Hosted Switch UI

**Goal:** Let hosted users configure switches and see readiness.

**Files:**

- Create: `web/src/pages/app/Trigger.tsx`
- Create: `web/src/components/switches/SwitchForm.tsx`
- Create: `web/src/components/switches/SwitchCard.tsx`
- Create: `web/src/components/switches/ReadinessChecklist.tsx`
- Create: `web/src/components/switches/SwitchActionButtons.tsx`
- Update: `web/src/App.tsx`

- [ ] **Step 1: Build switch list and form**

Support:

```text
trip mode
heartbeat mode
trigger date
heartbeat interval
grace period
warning window
selected contacts
selected estate items
```

- [ ] **Step 2: Build readiness checklist**

Use server readiness response.

- [ ] **Step 3: Build actions**

Support:

```text
arm
pause
cancel
check in
```

- [ ] **Step 4: Phase 2 limitation copy**

Show where appropriate:

```text
Phase 2 supports switch scheduling, reminders, and trigger-state tracking. Managed packet release and contact cascade are added in the next phase.
```

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/app/Trigger.tsx web/src/components/switches web/src/App.tsx
git commit -m "feat: add hosted switch ui"
```

---

## Task 18: Implement Relay Management UI

**Goal:** Let SaaS users manage Relay connections and copy one-time API keys for self-hosted instances.

**Files:**

- Create: `web/src/pages/app/Relay.tsx`
- Create: `web/src/components/relay/RelayConnectionCard.tsx`
- Create: `web/src/components/relay/CreateRelayConnectionModal.tsx`
- Create: `web/src/components/relay/RelayApiKeyReveal.tsx`
- Update: `web/src/App.tsx`

- [ ] **Step 1: List Relay connections**

Show:

```text
label
status
last heartbeat
next expected heartbeat
created date
```

- [ ] **Step 2: Create connection**

After creation, display raw API key once with copy button and warning:

```text
Copy this key now. Aegis stores only a hash and cannot show it again.
```

- [ ] **Step 3: Rotate/revoke**

Add rotate key and revoke actions.

- [ ] **Step 4: Clarify Relay Monitoring vs Escrow**

For Phase 2, label this as Relay Monitoring.

Copy:

```text
Relay Monitoring detects missed heartbeats and alerts you. It does not complete release by itself unless Relay Escrow is configured in a later phase.
```

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/app/Relay.tsx web/src/components/relay web/src/App.tsx
git commit -m "feat: add relay management ui"
```

---

## Task 19: Implement Marketing Landing and Pricing Pages

**Goal:** Add public marketing pages that explain the four product surfaces without overclaiming production readiness.

**Files:**

- Create/Update: `web/src/pages/marketing/Landing.tsx`
- Create/Update: `web/src/pages/marketing/Pricing.tsx`
- Create: `web/src/components/marketing/ProductSurfaceCards.tsx`
- Create: `web/src/components/marketing/PricingCards.tsx`
- Update: `web/src/App.tsx`

- [ ] **Step 1: Landing page**

Explain:

```text
Aegis Core
Aegis Relay
Aegis Hosted
DeadDrop API future layer
```

Recommended positioning:

```text
Encrypted legacy-release infrastructure for self-hosters, families, and platforms.
```

- [ ] **Step 2: Pricing page**

Use `/api/pricing`.

If price is null, show `View current pricing` link or `Pricing coming soon` depending on response.

- [ ] **Step 3: Avoid unsafe claims**

Do not claim:

```text
guaranteed release
zero knowledge
legal replacement
production audited security
```

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/marketing web/src/components/marketing web/src/App.tsx
git commit -m "feat: add marketing and pricing pages"
```

---

## Task 20: Documentation Updates

**Goal:** Document Phase 2 SaaS/Relay/Hosted behavior and limitations.

**Files:**

- Create/Update: `docs/relay.md`
- Create/Update: `docs/hosted.md`
- Create/Update: `docs/billing.md`
- Create/Update: `docs/security.md`
- Update: `README.md`

- [ ] **Step 1: Document Relay Monitoring**

Include heartbeat setup, API key handling, and offline alert behavior.

- [ ] **Step 2: Document Hosted limitations**

State:

```text
Phase 2 supports hosted data management and switch scheduling. Managed packet generation, contact cascade, and release flows are Phase 3.
```

- [ ] **Step 3: Document trust model**

Mention server-side encryption for Hosted v1 and no zero-knowledge claim.

- [ ] **Step 4: Commit**

```bash
git add docs README.md
git commit -m "docs: document phase two saas behavior"
```

---

## Task 21: End-to-End Phase 2 Verification

**Goal:** Verify SaaS Phase 2 works locally.

- [ ] **Step 1: Run tests**

```bash
cd server
npm test
```

- [ ] **Step 2: Build frontend**

```bash
cd web
npm run build
```

- [ ] **Step 3: Start local stack**

```bash
docker compose up -d
npm run dev
```

- [ ] **Step 4: Manual Relay smoke test**

Test:

```text
1. Register/login.
2. Verify email or bypass in dev mode if supported.
3. Create Relay connection.
4. Copy one-time API key.
5. Send test heartbeat with curl using Bearer key.
6. Confirm Relay status becomes active.
7. Simulate missed heartbeat.
8. Run relay monitor once.
9. Confirm status becomes offline and alert event is recorded.
10. Confirm no API key appears in logs/audit.
```

- [ ] **Step 5: Manual Hosted smoke test**

Test:

```text
1. Create estate item.
2. Create contact.
3. Create heartbeat switch.
4. View readiness.
5. Arm switch.
6. Check in.
7. Confirm dashboard updates.
8. Confirm DB stores sensitive fields encrypted.
9. Confirm audit logs contain no plaintext PII.
```

- [ ] **Step 6: Final commit**

```bash
git status
git commit -m "test: complete phase two saas verification" --allow-empty
```

---

## Phase 2 Acceptance Criteria

Phase 2 is complete when:

```text
- Relay connections can be created, listed, rotated, revoked, and deleted.
- Relay API keys are shown once and stored only as hashes.
- Relay heartbeat endpoint validates contract schema and updates status.
- Relay monitor detects missed heartbeats and sends/records alerts without spam.
- Hosted estate CRUD works with encrypted sensitive fields.
- Hosted contact CRUD works with encrypted sensitive fields and ordering.
- Hosted switch CRUD/actions/readiness work.
- Hosted dashboard summarizes estate/contact/switch/relay/subscription status.
- Billing portal route works.
- Marketing and pricing pages exist and use pricing API.
- App dashboard, estate, contacts, trigger, relay, and billing screens are usable.
- Audit logs contain no plaintext PII or secrets.
- All tests pass.
```

---

## Notes for Phase 3 Handoff

Phase 3 should start from these handoff points:

```text
Relay heartbeat monitoring works but does not release packets yet.
Hosted switches can reach triggered state but do not generate/release packets yet.
Hosted estate/contact data is encrypted and retrievable through service mappers.
Notification events and audit events exist.
Release runs exist and enforce one active release per user.
Relay Escrow trust copy exists, but release execution is still Phase 3.
Contract package is available for packet/cascade/claim work.
```
