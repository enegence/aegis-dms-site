# Aegis DMS Site — Phase 3: Managed Storage, Hosted Cascade, Relay Escrow, Claim Portal, Admin

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the release layer for the commercial Aegis DMS Site: managed R2/S3 storage, hosted packet generation, hosted notification dispatch, hosted switch worker/cascade, hosted claim portal, Relay-assisted cascade for offline self-hosted connections, explicit Relay Escrow key/material handling, and admin user/metrics dashboard — all with tests.

**Architecture:** Continue from Phase 2. The repo is a monorepo with `server/` (Fastify + Drizzle + PostgreSQL), `web/` (React + Vite + Tailwind), `packages/shared/`, and `packages/contracts/`. Phase 3 must support both commercial SaaS functions: **Aegis Hosted** for fully managed users and **Aegis Relay** for self-hosted users. Relay Monitoring detects offline status but cannot release alone. Relay Escrow is an explicit trusted mode where SaaS can execute the configured release policy if the local host remains offline.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, PostgreSQL, React 18, Vite, Tailwind CSS, Vitest, Node crypto AES-256-GCM, AWS SDK v3 for R2/S3-compatible storage, Postmark, Telegram Bot API, Stripe, `packages/contracts`, Docker/Railway.

**Parent plan:** `2026-05-06-aegis-master-plan.md`

**Target repo:** `aegis-dms-site/`

> **Note on phase labels:** Phase labels are sequencing guidance, not fixed delivery estimates. Optimize for correctness, security, and coherent architecture over calendar targets.

---

## Pre-requisites

Before starting, the engineer needs:

- SaaS Phase 1 completed and merged.
- SaaS Phase 2 completed using `2026-05-08-aegis-dms-site-phase2.md`.
- Auth/register/login/email verification/password reset/session/CSRF working.
- Stripe checkout, webhook, subscription lifecycle, pricing API, and billing portal working.
- Postmark email service working.
- Relay connection management, API-key hashing/rotation/revocation working.
- Relay heartbeat API and Relay monitor working.
- Hosted estate/contact/switch CRUD working with encrypted sensitive fields.
- Hosted switch readiness/actions/dashboard working.
- Marketing and pricing pages working.
- `packages/contracts` compatible with OSS contracts.
- PostgreSQL schema contains `packets`, `contact_claims`, `release_runs`, `trust_acknowledgements`, `audit_events`, `relay_connections`, and hosted domain tables.
- Browser state-changing routes require auth + CSRF.
- API-key routes such as Relay heartbeat require hashed API-key auth and strict validation, not browser CSRF.

---

## Phase 3 Scope Boundary

### In Scope

- Managed R2/S3-compatible storage service.
- Per-user/per-release packet object prefixing.
- Hosted packet builder and packet encryption.
- Hosted packet metadata API.
- Hosted notification dispatch via Postmark and Telegram.
- Hosted worker extension for packet generation, release runs, cascade, escalation, completion/failure.
- Hosted contact cascade.
- Hosted public claim API and claim portal UI.
- Relay-assisted cascade when an OSS instance is offline and eligible.
- Relay Escrow release material model and acknowledgement enforcement.
- Admin API: user list, subscription summary, relay status, hosted usage, basic metrics.
- Admin dashboard UI.
- Redacted audit events across hosted, relay, packet, claim, admin, and notification operations.
- Tests for storage, packets, notifications, hosted cascade, claim flow, Relay Escrow eligibility, and admin access control.

### Explicitly Out of Scope Until Phase 4

- Railway deployment finalization.
- Production DNS/SSL setup.
- Cancellation/grace-period edge polishing beyond existing billing state.
- Final legal pages.
- Full email template design polish.
- Public DeadDrop partner API, SDK, developer portal, and metering UI.
- Shamir Secret Sharing.
- Zero-knowledge claims.
- Mobile app/native app.

### Security Non-Negotiables

- No Shamir in this phase.
- No zero-knowledge claims.
- Relay Monitoring must not execute release without Relay Escrow material/authorization.
- Relay Escrow must require explicit, versioned trust acknowledgement.
- Hosted SaaS is server-side encrypted and trusted infrastructure for v1.
- Do not log plaintext estate/contact data, packet contents, release keys, storage credentials, API keys, claim tokens, or contact PII.
- Store API keys only as hashes server-side.
- Store claim tokens only as hashes server-side.
- Public claim routes must be rate-limited and generic on invalid/expired token failures.

---

## Task 1: Verify and Extend Phase 3 Schema

**Goal:** Ensure PostgreSQL schema supports managed packets, storage metadata, hosted/relay release runs, contact claims, Relay Escrow acknowledgements, notification events, and admin metrics.

**Files:**

- Update: `server/src/db/schema.ts`
- Update/Create: `server/drizzle/*.sql`
- Test: `server/tests/schema-phase3.test.ts`

- [x] **Step 1: Confirm existing required tables**

Confirm these tables exist:

```text
users
sessions
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

- [x] **Step 2: Confirm encrypted hosted fields**

Estate sensitive fields remain encrypted:

```text
institutionNameEncrypted
accountTypeEncrypted
referenceHintEncrypted
assetDescriptionEncrypted
locationNotesEncrypted
executorNotesEncrypted
```

Contact sensitive fields remain encrypted:

```text
fullNameEncrypted
relationshipEncrypted
emailEncrypted
phoneEncrypted
telegramHandleEncrypted
backupNotesEncrypted
```

- [x] **Step 3: Extend packets table if needed**

The `packets` table should support both hosted and relay packets:

```typescript
id
userId
switchId nullable
releaseRunId nullable
relayConnectionId nullable
sourceApp: 'aegis_hosted' | 'aegis_core' | 'partner'
version
schemaVersion
encryptionAlgorithm
keyId
contentHash
encryptedObjectHash
storageProvider
storageBucket
storageObjectKey
storageRegion
storageVersionId
lastVerifiedAt
expiresAt
createdAt
```

- [x] **Step 4: Extend contact claims table if needed**

`contact_claims` should store token hashes only:

```typescript
claimTokenHash
status
notifiedAt
openedAt
verifiedAt
acceptedAt
packetDownloadedAt
keyViewedAt
acknowledgedAt
expiresAt
escalatedAt
failedAt
```

- [x] **Step 5: Extend release runs table if needed**

`release_runs` should support:

```typescript
userId
triggeringSwitchId nullable
relayConnectionId nullable
source: 'hosted' | 'relay_escrow'
status
activePacketId
currentContactClaimId
suppressedSwitchIds jsonb
metadata jsonb redacted only
startedAt
completedAt
cancelledAt
```

- [x] **Step 6: Add notification event table if missing**

Create `notification_events` if Phase 2 did not add one:

```typescript
id
userId
releaseRunId nullable
contactClaimId nullable
channel
provider
recipientRef // contactId or redacted reference, not plaintext address
status
providerMessageId nullable
errorCode nullable
errorMessageRedacted nullable
createdAt
updatedAt
```

- [x] **Step 7: Add Relay Escrow material table if missing**

Create `relay_escrow_materials`:

```typescript
id
userId
relayConnectionId
enabled boolean
materialType // packet_key | release_bundle | policy_ref
materialEncrypted text
policyVersion text
acceptedAcknowledgementId
createdAt
updatedAt
revokedAt nullable
```

Do not store unencrypted key material.

- [x] **Step 8: Add migration tests**

Test:

```text
packets support hosted and relay sourceApp
claim tokens are hash-only
release runs support hosted and relay escrow sources
relay escrow material is encrypted only
notification events do not require plaintext recipient data
```

- [x] **Step 9: Commit**

```bash
git add server/src/db/schema.ts server/drizzle server/tests/schema-phase3.test.ts
git commit -m "feat: extend saas schema for managed packets cascade and relay escrow"
```

---

## Task 2: Update Shared Types and Contract Usage

**Goal:** Add SaaS-facing types for packet summaries, release runs, claims, relay escrow, notification events, and admin metrics.

**Files:**

- Update: `packages/shared/src/types.ts`
- Update: `packages/contracts/src/packet-envelope.ts`
- Update: `packages/contracts/src/release-run.ts`
- Update: `packages/contracts/src/claim-event.ts`
- Update: `packages/contracts/src/webhook-event.ts`
- Test: `packages/contracts/tests/contracts.test.ts`

- [x] **Step 1: Add packet and release types**

Add:

```typescript
export type PacketSourceApp = 'aegis_core' | 'aegis_hosted' | 'partner';
export type ReleaseRunSource = 'hosted' | 'relay_escrow';
export type ReleaseRunStatus = 'active' | 'cascade_active' | 'completed' | 'cancelled' | 'failed';
```

- [x] **Step 2: Add Relay Escrow types**

```typescript
export type RelayEscrowStatus = 'disabled' | 'pending_acknowledgement' | 'enabled' | 'revoked';

export interface RelayEscrowSummary {
  relayConnectionId: string;
  status: RelayEscrowStatus;
  policyVersion: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
}
```

- [x] **Step 3: Add admin metrics types**

```typescript
export interface AdminMetricsSummary {
  userCount: number;
  activeSubscriptions: number;
  relayConnections: number;
  offlineRelayConnections: number;
  hostedSwitchesArmed: number;
  activeReleaseRuns: number;
  packetsStored: number;
}
```

- [x] **Step 4: Confirm packet envelope accepts SaaS sources**

`sourceApp` must allow:

```text
aegis_core
aegis_hosted
partner
```

- [x] **Step 5: Add contract tests**

Test:

```text
hosted packet envelope parses
relay escrow release run parses
claim events parse for hosted and relay escrow sources
invalid sourceApp fails
```

- [x] **Step 6: Commit**

```bash
git add packages/shared packages/contracts
git commit -m "feat: add saas packet release relay escrow and admin shared types"
```

---

## Task 3: Implement Managed Storage Service

**Goal:** Store encrypted hosted/relay packets in managed R2/S3-compatible storage using per-user prefixes.

**Files:**

- Update: `server/package.json`
- Create: `server/src/services/storage/managed-storage.ts`
- Create: `server/src/services/storage/index.ts`
- Update: `server/src/config.ts`
- Test: `server/tests/managed-storage.test.ts`

- [x] **Step 1: Add dependencies**

```bash
cd server && npm install @aws-sdk/client-s3 @aws-sdk/lib-storage
```

- [x] **Step 2: Add config**

Add environment variables:

```bash
AEGIS_STORAGE_ENDPOINT=
AEGIS_STORAGE_REGION=auto
AEGIS_STORAGE_BUCKET=
AEGIS_STORAGE_ACCESS_KEY_ID=
AEGIS_STORAGE_SECRET_ACCESS_KEY=
AEGIS_STORAGE_PREFIX=packets/
AEGIS_STORAGE_FORCE_PATH_STYLE=false
```

- [x] **Step 3: Define object key format**

Use:

```text
<prefix>/users/<user-id>/release-runs/<release-run-id>/packets/<packet-id>-v<version>.aegis.enc
```

For Relay Escrow:

```text
<prefix>/users/<user-id>/relay/<relay-connection-id>/release-runs/<release-run-id>/packets/<packet-id>-v<version>.aegis.enc
```

- [x] **Step 4: Implement provider**

Functions:

```typescript
uploadManagedPacket(input)
verifyManagedPacket(input)
downloadManagedPacket(input)
deleteManagedPacket(input)
```

- [x] **Step 5: Verify upload**

After upload:

```text
HEAD object
store object key
store ETag/versionId if available
store lastVerifiedAt
compare encryptedObjectHash if available
```

- [x] **Step 6: Add tests with mocked S3 client**

Test:

```text
hosted packet uses hosted prefix
relay packet uses relay prefix
upload persists metadata
verify handles missing object
credentials never logged
```

- [x] **Step 7: Commit**

```bash
git add server/package.json package-lock.json server/src/config.ts server/src/services/storage server/tests/managed-storage.test.ts
git commit -m "feat: add managed packet storage service"
```

---

## Task 4: Implement Hosted Packet Crypto and Builder

**Goal:** Assemble hosted user estate/contact data into encrypted managed packets.

**Files:**

- Create: `server/src/services/packet-crypto.ts`
- Create: `server/src/services/hosted-packet-builder.ts`
- Create: `server/src/repositories/packet-repository.ts`
- Test: `server/tests/hosted-packet-builder.test.ts`
- Test: `server/tests/packet-crypto.test.ts`

- [x] **Step 1: Implement packet crypto**

Use:

```text
AES-256-GCM
32-byte random packet keys
12-byte random IVs
sha256 content hash
sha256 encrypted object hash
base64url envelope fields
```

- [x] **Step 2: Define hosted packet payload**

Plaintext payload includes:

```typescript
schemaVersion
sourceApp: 'aegis_hosted'
generatedAt
user/owner display data
switch summary
selected estate items decrypted server-side
selected contacts decrypted server-side
release disclaimers
```

Do not include:

```text
password hashes
sessions
Stripe data
API keys
storage credentials
Postmark tokens
Telegram bot tokens
relay API keys
```

- [x] **Step 3: Generate DeadDrop envelope**

Validate against `packages/contracts` packet envelope schema.

- [x] **Step 4: Persist packet metadata**

Persist packet metadata and upload encrypted object through managed storage.

- [x] **Step 5: Add tests**

Test:

```text
packet includes selected hosted estate/contact data
sensitive DB fields are decrypted only inside builder
packet excludes platform credentials and billing data
packet envelope validates
packet metadata persisted
storage upload invoked
```

- [x] **Step 6: Commit**

```bash
git add server/src/services/packet-crypto.ts server/src/services/hosted-packet-builder.ts server/src/repositories/packet-repository.ts server/tests/hosted-packet-builder.test.ts server/tests/packet-crypto.test.ts
git commit -m "feat: build encrypted hosted legacy packets"
```

---

## Task 5: Implement Packet API Routes

**Goal:** Provide authenticated hosted packet operations for generation, listing, verification, and deletion.

**Files:**

- Create/Update: `server/src/routes/packets.ts`
- Update: `server/src/index.ts`
- Test: `server/tests/packets-routes.test.ts`

- [x] **Step 1: Add routes**

Implement:

```text
GET    /api/app/packets
GET    /api/app/packets/:id
POST   /api/app/switches/:id/packets/generate
POST   /api/app/packets/:id/verify
DELETE /api/app/packets/:id
```

- [x] **Step 2: Enforce auth/subscription/CSRF**

Rules:

```text
hosted packet generation requires authenticated user
state-changing routes require CSRF
hosted packet generation requires hosted subscription or internal test mode
users can only access their own packets
```

- [x] **Step 3: Return metadata only**

Do not return packet plaintext through owner UI routes.

- [x] **Step 4: Add tests**

Test:

```text
unauthenticated denied
wrong user denied
missing subscription denied where applicable
generate creates and uploads packet
list returns metadata only
delete removes managed object and marks deleted
```

- [x] **Step 5: Commit**

```bash
git add server/src/routes/packets.ts server/src/index.ts server/tests/packets-routes.test.ts
git commit -m "feat: add hosted packet management routes"
```

---

## Task 6: Implement Hosted Notification Dispatch

**Goal:** Send release/cascade notifications using managed Postmark and shared Telegram bot.

**Files:**

- Update: `server/src/services/email.ts`
- Create: `server/src/services/telegram.ts`
- Create: `server/src/services/notifications.ts`
- Create: `server/src/repositories/notification-event-repository.ts`
- Test: `server/tests/hosted-notifications.test.ts`

- [x] **Step 1: Define notification service API**

```typescript
sendOwnerAlert(input)
sendContactClaimNotification(input)
sendRelayOfflineAlert(input)
sendCascadeEscalationNotice(input)
```

- [x] **Step 2: Implement Postmark dispatch**

Use existing Postmark service. Templates can be plain HTML/text in Phase 3.

- [x] **Step 3: Implement Telegram dispatch**

Use shared bot token. Telegram is optional per contact/user.

- [x] **Step 4: Store notification events**

Persist:

```text
channel
provider
recipientRef
status
providerMessageId
redacted error
```

Do not persist plaintext email/phone/message body.

- [x] **Step 5: Add tests**

Test:

```text
Postmark claim notification called
Telegram notification called when configured
notification event persisted
provider failure redacted and recorded
no plaintext contact PII in notification event
```

- [x] **Step 6: Commit**

```bash
git add server/src/services/email.ts server/src/services/telegram.ts server/src/services/notifications.ts server/src/repositories/notification-event-repository.ts server/tests/hosted-notifications.test.ts
git commit -m "feat: add hosted notification dispatch"
```

---

## Task 7: Implement Hosted Release Run Service

**Goal:** Start and manage hosted release runs while enforcing one active release run per user.

**Files:**

- Create: `server/src/services/hosted-release-run.ts`
- Create: `server/src/repositories/release-run-repository.ts`
- Update: `server/src/services/hosted-switch-engine.ts`
- Test: `server/tests/hosted-release-run.test.ts`

- [x] **Step 1: Define service API**

```typescript
startOrAttachHostedReleaseRun(input: {
  userId: string;
  triggeringSwitchId: string;
  reason: 'trip_triggered' | 'heartbeat_missed' | 'manual_test';
}): Promise<ReleaseRunStartResult>
```

- [x] **Step 2: Enforce single active run per user**

If no active run exists:

```text
create release run
set source = hosted
generate/upload active packet
write audit event
```

If active run exists:

```text
append/suppress switch ID
write audit event
return existing run
DO NOT start parallel cascade
```

- [x] **Step 3: Integrate hosted switch engine**

Triggered hosted switches should create/attach release runs, not directly start cascades.

- [x] **Step 4: Add tests**

Test:

```text
triggered hosted switch creates run
duplicate trigger attaches to active run
packet generated on new run
no duplicate cascade starts
completed run allows later run
```

- [x] **Step 5: Commit**

```bash
git add server/src/services/hosted-release-run.ts server/src/repositories/release-run-repository.ts server/src/services/hosted-switch-engine.ts server/tests/hosted-release-run.test.ts
git commit -m "feat: add hosted release run service"
```

---

## Task 8: Implement Hosted Contact Cascade

**Goal:** Execute hosted contact cascade using managed notifications and hosted claim portal.

**Files:**

- Create: `server/src/services/hosted-cascade.ts`
- Create: `server/src/repositories/contact-claim-repository.ts`
- Test: `server/tests/hosted-cascade.test.ts`

- [x] **Step 1: Define cascade lifecycle**

Use statuses:

```text
pending
notified
opened
verified
accepted
packet_downloaded
key_viewed
acknowledged
expired
escalated
failed
```

- [x] **Step 2: Start cascade with first contact**

Behavior:

```text
create claim with token hash
send contact notification
set notifiedAt
set releaseRun.currentContactClaimId
write audit event
```

- [x] **Step 3: Escalate on timeout**

Use contact `confirmationWindowHours`.

- [x] **Step 4: Complete on acknowledgement**

Completion requires:

```text
accepted
packet_downloaded
key_viewed or release material delivered
acknowledged
```

- [x] **Step 5: Add tests**

Test:

```text
cascade starts with priority contact
claim token hash only
notification sent
claim timeout escalates
all contacts exhausted marks failed
acknowledged claim completes release run and switch
```

- [x] **Step 6: Commit**

```bash
git add server/src/services/hosted-cascade.ts server/src/repositories/contact-claim-repository.ts server/tests/hosted-cascade.test.ts
git commit -m "feat: implement hosted contact cascade"
```

---

## Task 9: Extend Hosted Worker for Packets and Cascade

**Goal:** Make SaaS worker progress hosted switches, packet generation, release runs, cascades, escalation, and completion.

**Files:**

- Update: `server/src/worker/index.ts`
- Create/Update: `server/src/worker/hosted-worker.ts`
- Test: `server/tests/hosted-worker-phase3.test.ts`

- [x] **Step 1: Add hosted worker loop**

Worker should:

```text
evaluate hosted armed switches
start/attach release run when triggered
ensure active packet exists
start cascade if needed
escalate expired claims
complete acknowledged release runs
fail exhausted release runs
```

- [x] **Step 2: Enforce idempotency**

Repeated ticks must not:

```text
create duplicate release runs
create duplicate packets
send duplicate claim notifications
create duplicate claims
```

- [x] **Step 3: Add tests**

Test:

```text
triggered switch creates release run and packet
second tick does not duplicate packet/notification
expired claim escalates
acknowledged claim completes run
exhausted cascade fails run
```

- [x] **Step 4: Commit**

```bash
git add server/src/worker/index.ts server/src/worker/hosted-worker.ts server/tests/hosted-worker-phase3.test.ts
git commit -m "feat: progress hosted release cascades from worker"
```

---

## Task 10: Implement Hosted Public Claim API

**Goal:** Provide public hosted claim routes for contacts.

**Files:**

- Create/Update: `server/src/routes/claim.ts`
- Update: `server/src/index.ts`
- Test: `server/tests/hosted-claim-routes.test.ts`

- [x] **Step 1: Add routes**

Implement:

```text
GET  /claim/:token
GET  /api/claim/:token
POST /api/claim/:token/open
POST /api/claim/:token/verify
POST /api/claim/:token/accept
GET  /api/claim/:token/packet
POST /api/claim/:token/key-view
POST /api/claim/:token/acknowledge
```

- [x] **Step 2: Token handling**

Hash incoming token and compare to `claimTokenHash`.

- [x] **Step 3: Verification**

Support contact PIN where configured. Rate limit failures.

- [x] **Step 4: Packet download**

Allow only after claim accepted and not expired/escalated/failed.

- [x] **Step 5: Key/release material behavior**

For Hosted v1:

```text
server-side release material may be presented after accepted + verified state
record keyViewedAt/releaseMaterialViewedAt
never log material
```

- [x] **Step 6: Acknowledgement**

Acknowledgement completes claim, release run, and switch when required access steps are complete.

- [x] **Step 7: Add tests**

Test:

```text
invalid token generic 404
expired denied
open updates openedAt
verify handles PIN
packet before accept denied
packet after accept allowed
key view audited without material in logs
acknowledge completes run
```

- [x] **Step 8: Commit**

```bash
git add server/src/routes/claim.ts server/src/index.ts server/tests/hosted-claim-routes.test.ts
git commit -m "feat: add hosted public claim api"
```

---

## Task 11: Implement Claim Portal UI

**Goal:** Build SaaS-hosted contact claim portal UI.

**Files:**

- Create: `web/src/pages/claim/ClaimLanding.tsx`
- Create: `web/src/pages/claim/ClaimVerify.tsx`
- Create: `web/src/pages/claim/ClaimAccept.tsx`
- Create: `web/src/pages/claim/ClaimDownload.tsx`
- Create: `web/src/pages/claim/ClaimAcknowledge.tsx`
- Update: `web/src/App.tsx`
- Update: `web/src/lib/api.ts`

- [x] **Step 1: Add public routes**

```text
/claim/:token
/claim/:token/verify
/claim/:token/accept
/claim/:token/download
/claim/:token/acknowledge
```

- [x] **Step 2: Landing page**

Show:

```text
owner display name
claim expiration
plain-language explanation
status
```

- [x] **Step 3: Verify page**

Handle PIN or explicit verification confirmation.

- [x] **Step 4: Accept page**

Require explicit responsibility acknowledgement.

- [x] **Step 5: Download/key page**

Show packet download/release material actions only if API allows.

- [x] **Step 6: Acknowledge page**

Final receipt acknowledgement.

- [x] **Step 7: Error states**

Handle invalid, expired, escalated, already completed, and unavailable states.

- [x] **Step 8: Commit**

```bash
git add web/src/pages/claim web/src/App.tsx web/src/lib/api.ts
git commit -m "feat: add hosted claim portal ui"
```

---

## Task 12: Implement Relay Escrow Material Model

**Goal:** Allow explicit Relay Escrow configuration without false zero-knowledge or Shamir claims.

**Files:**

- Create: `server/src/services/relay-escrow.ts`
- Create: `server/src/routes/relay-escrow.ts`
- Update: `server/src/index.ts`
- Test: `server/tests/relay-escrow.test.ts`

- [x] **Step 1: Require acknowledgement**

Relay Escrow cannot be enabled unless a current `trust_acknowledgements` row exists for:

```text
mode = relay_escrow
version = current policy version
```

- [x] **Step 2: Store encrypted material only**

Store escrow material in `relay_escrow_materials.materialEncrypted`.

Do not store plaintext key/release material.

- [x] **Step 3: Add routes**

Implement authenticated routes:

```text
GET  /api/relay/:id/escrow
POST /api/relay/:id/escrow/acknowledge
POST /api/relay/:id/escrow/enable
POST /api/relay/:id/escrow/revoke
```

All require auth + CSRF.

- [x] **Step 4: Add tests**

Test:

```text
enable without acknowledgement rejected
acknowledge creates versioned row
enable stores encrypted material
revoke marks revokedAt
Relay Monitoring connection cannot execute release without escrow enabled
```

- [x] **Step 5: Commit**

```bash
git add server/src/services/relay-escrow.ts server/src/routes/relay-escrow.ts server/src/index.ts server/tests/relay-escrow.test.ts
git commit -m "feat: add explicit relay escrow material model"
```

---

## Task 13: Implement Relay-Assisted Cascade

**Goal:** Allow SaaS to execute release only for Relay Escrow connections when the self-hosted instance remains offline and policy allows release.

**Files:**

- Create: `server/src/services/relay-assisted-cascade.ts`
- Update: `server/src/services/relay-monitor.ts`
- Update: `server/src/worker/index.ts`
- Test: `server/tests/relay-assisted-cascade.test.ts`

- [ ] **Step 1: Define eligibility**

Relay-assisted cascade requires:

```text
relay connection offline beyond configured threshold
subscription active or allowed grace status
Relay Escrow enabled
current trust acknowledgement exists
escrow material not revoked
release policy conditions satisfied
no active release run for user
```

- [ ] **Step 2: Monitoring-only behavior**

If connection is Relay Monitoring only:

```text
send owner/contact warning alerts as configured
mark status offline
DO NOT create release run
DO NOT release packet/key material
```

- [ ] **Step 3: Escrow behavior**

If eligible Relay Escrow:

```text
create release run with source = relay_escrow
prepare active packet/reference from escrow policy
start contact cascade
write audit event
```

- [ ] **Step 4: Add tests**

Test:

```text
offline monitoring-only connection does not start release
offline escrow connection starts release when policy permits
revoked escrow blocks release
inactive subscription blocks or pauses according to policy
active release run prevents duplicate relay release
```

- [ ] **Step 5: Commit**

```bash
git add server/src/services/relay-assisted-cascade.ts server/src/services/relay-monitor.ts server/src/worker/index.ts server/tests/relay-assisted-cascade.test.ts
git commit -m "feat: add relay-assisted cascade for escrow connections"
```

---

## Task 14: Implement Admin API

**Goal:** Provide admin-safe visibility into users, subscriptions, Relay status, hosted usage, packets, release runs, and system metrics.

**Files:**

- Create/Update: `server/src/routes/admin.ts`
- Create: `server/src/services/admin-metrics.ts`
- Update: `server/src/index.ts`
- Test: `server/tests/admin-routes.test.ts`

- [ ] **Step 1: Add admin guard**

Use existing user role if present. If roles do not exist, add minimal field:

```text
users.role = user | admin | sa
```

Only `admin`/`sa` can access admin routes.

- [ ] **Step 2: Add routes**

Implement:

```text
GET /api/admin/metrics
GET /api/admin/users
GET /api/admin/users/:id
GET /api/admin/relay-connections
GET /api/admin/release-runs
GET /api/admin/packets
GET /api/admin/notifications
```

- [ ] **Step 3: Redact sensitive fields**

Admin API must not return:

```text
estate plaintext
contact plaintext
packet plaintext
release material
API keys
claim tokens
storage credentials
password hashes
reset tokens
```

- [ ] **Step 4: Add metrics**

Metrics:

```text
total users
verified users
active subscriptions
relay connections active/offline
hosted switches armed/warning/triggered
active release runs
packets generated/stored
notification failures last 24h
```

- [ ] **Step 5: Add tests**

Test:

```text
non-admin denied
admin allowed
metrics return counts
user detail redacts sensitive data
release run list redacts metadata
```

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/admin.ts server/src/services/admin-metrics.ts server/src/index.ts server/tests/admin-routes.test.ts
git commit -m "feat: add admin metrics and management api"
```

---

## Task 15: Implement Admin Dashboard UI

**Goal:** Add admin dashboard pages for operational visibility.

**Files:**

- Create: `web/src/pages/admin/AdminDashboard.tsx`
- Create: `web/src/pages/admin/AdminUsers.tsx`
- Create: `web/src/pages/admin/AdminRelay.tsx`
- Create: `web/src/pages/admin/AdminReleaseRuns.tsx`
- Create: `web/src/components/admin/AdminMetricCard.tsx`
- Create: `web/src/components/admin/AdminTable.tsx`
- Update: `web/src/App.tsx`
- Update: `web/src/lib/api.ts`

- [ ] **Step 1: Add routes**

```text
/admin
/admin/users
/admin/relay
/admin/release-runs
```

- [ ] **Step 2: Dashboard metrics**

Show:

```text
users
subscriptions
relay health
active release runs
packets stored
notification failures
```

- [ ] **Step 3: Users page**

Show redacted user list:

```text
email
display name
verified status
subscription status
created date
```

- [ ] **Step 4: Relay page**

Show:

```text
connection label
status
last heartbeat
subscription/user ref
escrow enabled yes/no
```

- [ ] **Step 5: Release runs page**

Show:

```text
source
status
started/completed
trigger reference
current claim status
```

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/admin web/src/components/admin web/src/App.tsx web/src/lib/api.ts
git commit -m "feat: add admin dashboard ui"
```

---

## Task 16: Add Hosted Release and Packet UI

**Goal:** Give hosted users visibility into packet status, active release runs, cascade status, and managed storage state.

**Files:**

- Create/Update: `web/src/pages/app/Release.tsx`
- Create: `web/src/components/release/PacketStatusCard.tsx`
- Create: `web/src/components/release/ReleaseRunCard.tsx`
- Create: `web/src/components/release/CascadeStatusCard.tsx`
- Update: `web/src/pages/app/Dashboard.tsx`
- Update: `web/src/App.tsx`

- [ ] **Step 1: Add hosted release page**

Route:

```text
/app/release
```

- [ ] **Step 2: Show packet status**

Display:

```text
latest packet version
created at
storage status
last verified
```

- [ ] **Step 3: Show release run status**

Display active/completed/failed release runs.

- [ ] **Step 4: Show cascade status**

Display current contact step using redacted labels only.

- [ ] **Step 5: Add manual actions**

Support:

```text
generate packet
verify packet
simulate release
cancel release run
```

- [ ] **Step 6: Update app dashboard**

Add cards for:

```text
Packet Ready
Managed Storage Health
Active Release
Recent Release Activity
```

- [ ] **Step 7: Commit**

```bash
git add web/src/pages/app/Release.tsx web/src/components/release web/src/pages/app/Dashboard.tsx web/src/App.tsx
git commit -m "feat: add hosted release and packet ui"
```

---

## Task 17: Add Audit Coverage and Redaction Tests

**Goal:** Ensure every Phase 3 release operation writes useful but redacted audit events.

**Files:**

- Update: `server/src/services/audit.ts`
- Test: `server/tests/audit-phase3.test.ts`

- [ ] **Step 1: Add event types**

Add audit events for:

```text
packet_generated
packet_uploaded
packet_verified
packet_deleted
release_run_started
release_run_suppressed_duplicate
contact_claim_created
contact_notified
contact_opened_claim
contact_verified
contact_accepted
packet_downloaded
release_material_viewed
claim_acknowledged
contact_escalated
cascade_completed
cascade_failed
relay_escrow_enabled
relay_escrow_revoked
relay_assisted_release_started
admin_viewed_metrics
```

- [ ] **Step 2: Redaction tests**

Test that audit metadata never contains:

```text
email address
phone number
institution name
packet plaintext
release material
API key
claim token
storage credential
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/audit.ts server/tests/audit-phase3.test.ts
git commit -m "test: enforce phase 3 audit redaction"
```

---

## Task 18: Documentation Updates

**Goal:** Document managed storage, Hosted release, Relay Monitoring vs Relay Escrow, and claim portal behavior.

**Files:**

- Create/Update: `docs/hosted.md`
- Create/Update: `docs/relay.md`
- Create/Update: `docs/key-management.md`
- Create/Update: `docs/claim-portal.md`
- Create/Update: `docs/admin.md`

- [ ] **Step 1: Hosted docs**

Document:

```text
server-side encryption model
managed storage
hosted packet generation
hosted claim portal
trust assumptions
```

- [ ] **Step 2: Relay docs**

Document:

```text
Relay Monitoring vs Relay Escrow
what monitoring can and cannot do
what escrow means
acknowledgement requirement
revocation
```

- [ ] **Step 3: Key management docs**

Explicitly state:

```text
no Shamir in alpha
no zero-knowledge claims
Hosted is trusted SaaS infrastructure
Relay Escrow requires explicit trust
```

- [ ] **Step 4: Admin docs**

Document admin visibility and redaction limitations.

- [ ] **Step 5: Commit**

```bash
git add docs/hosted.md docs/relay.md docs/key-management.md docs/claim-portal.md docs/admin.md
git commit -m "docs: document hosted relay escrow claim and admin behavior"
```

---

## Task 19: End-to-End Phase 3 Verification

**Goal:** Verify managed hosted release and Relay Escrow flows are coherent and tested.

**Files:**

- Create: `server/tests/phase3-hosted-flow.test.ts`
- Create: `server/tests/phase3-relay-escrow-flow.test.ts`
- Update: `README.md` if useful

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Hosted flow test**

Test:

```text
user has hosted subscription
estate/contact/switch data exists
switch is armed
packet generated and stored
switch triggers
release run starts
cascade starts
contact opens/verifies/accepts
packet downloaded
release material viewed
claim acknowledged
release run completed
audit log redacted
```

- [ ] **Step 3: Relay Escrow flow test**

Test:

```text
relay connection exists
trust acknowledgement accepted
escrow material enabled
offline threshold reached
relay-assisted release starts
cascade starts
claim acknowledged
release run completed
monitoring-only connection does not release
revoked escrow does not release
```

- [ ] **Step 4: Manual smoke test**

Run app and verify:

```text
hosted user can generate/verify packet
hosted release page shows packet status
claim portal opens from notification link
admin dashboard shows metrics
Relay Monitoring offline state does not release without escrow
Relay Escrow requires acknowledgement before enablement
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "test: verify phase 3 hosted relay escrow and claim flows"
```

---

## Phase 3 Completion Checklist

Phase 3 is complete when:

- [ ] Managed storage service uploads/verifies/downloads/deletes encrypted packets.
- [ ] Hosted packet builder creates valid encrypted packet envelopes.
- [ ] Hosted packet routes are authenticated, CSRF-protected, and user-scoped.
- [ ] Hosted notification dispatch works through Postmark and Telegram.
- [ ] Hosted release run service enforces one active run per user.
- [ ] Hosted worker starts/progresses/completes/fails cascades idempotently.
- [ ] Hosted contact cascade supports notify, verify, accept, download, key/material view, acknowledge, escalate, and fail.
- [ ] Hosted claim API and claim portal UI are functional.
- [ ] Relay Escrow material model requires acknowledgement and stores encrypted material only.
- [ ] Relay-assisted cascade only runs for eligible Relay Escrow connections.
- [ ] Relay Monitoring never releases by itself.
- [ ] Admin API and dashboard show redacted operational metrics.
- [ ] Audit events cover all Phase 3 operations and are redaction-tested.
- [ ] Docs clearly describe Hosted, Relay Monitoring, Relay Escrow, claim portal, and key-management limitations.
- [ ] Full test suite passes.

---

## Handoff Notes for Phase 4

Phase 4 should build on this by adding:

- onboarding flow polish;
- Relay connection UI polish and OSS linking UX;
- Stripe customer portal polish;
- Railway deployment config;
- domain/DNS/SSL setup;
- production environment variable docs;
- email template design polish;
- legal pages: Privacy, Terms, disclaimers;
- full E2E browser flows;
- security review;
- launch-readiness documentation.
