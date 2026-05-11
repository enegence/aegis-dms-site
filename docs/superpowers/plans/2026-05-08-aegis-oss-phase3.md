# Aegis OSS — Phase 3: Encryption, Packets, Dead Drop, Cascade

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the secure release layer for the open-source Aegis Core app: packet generation, packet encryption, S3-compatible dead-drop storage, worker packet sync, release-run execution, contact cascade, public claim portal, escalation/timeout handling, Release page, and audit log display — all with tests.

**Architecture:** Continue from Phase 2. The repo is a monorepo with `server/` (Fastify + Drizzle + SQLite), `web/` (React + Vite + Tailwind), `packages/shared/`, and `packages/contracts/`. Phase 3 attaches packet/cascade/release behavior to the Phase 2 switch engine. The local app remains the authority for OSS release execution. Dead Drop mode uploads encrypted packets while the owner is alive. Relay-assisted behavior remains limited unless Relay Escrow is explicitly configured by SaaS in a later integrated flow.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, better-sqlite3, React 18, Vite, Tailwind CSS, Vitest, Node crypto AES-256-GCM, S3-compatible storage via AWS SDK v3, SMTP/Telegram notification providers from Phase 2, `packages/contracts`, Docker.

**Parent plan:** `2026-05-06-aegis-master-plan.md`

**Target repo:** `aegis/`

> **Note on phase labels:** Phase labels are sequencing guidance, not fixed delivery estimates. Optimize for correctness, security, and coherent architecture over calendar targets.

---

## Pre-requisites

Before starting, the engineer needs:

- Phase 1 completed and passing.
- Phase 2 completed using `2026-05-08-aegis-oss-phase2.md`.
- Owner setup/login/session/CSRF flow working.
- Estate item CRUD with encrypted sensitive fields working.
- Contact CRUD with encrypted sensitive fields and priority ordering working.
- Switch CRUD/actions/readiness gates/check-in working.
- Notification providers for SMTP and Telegram working.
- Worker polling loop working for reminders, warnings, and trigger evaluation.
- Dashboard and switch management UI working.
- `packages/contracts` available with packet envelope, release run, heartbeat, claim event, webhook event, storage provider, and notification provider schemas.
- SQLite schema contains `switches`, `packets`, `contact_claims`, `release_runs`, `audit_events`, and app/settings tables.
- All owner-authenticated state-changing routes must require auth + CSRF.
- Public claim routes must not require owner auth, but must use claim tokens, claim PIN/verification where configured, rate limits, and strict payload validation.

---

## Phase 3 Scope Boundary

### In Scope

- AES-256-GCM packet encryption helpers.
- Packet key generation and packet key metadata.
- Owner passphrase/key-release preparation for local release.
- Packet builder: selected estate items + selected contacts + release instructions → canonical JSON → encrypted packet.
- DeadDrop packet envelope validation using `packages/contracts`.
- Packet versioning and packet metadata.
- S3-compatible storage provider: upload, head/verify, download, delete, rotate.
- Dead Drop sync in worker.
- Release run creation from triggered switches.
- Release-run constraint enforcement using first-class `release_runs`.
- Contact cascade: notify → verify → accept → download → key view → acknowledge.
- Public claim API routes.
- Public claim portal UI.
- Escalation/timeout handling.
- Release page showing mode, active release, packet sync, cascade status, and readiness.
- Audit log API and UI.
- Tests for packet crypto, storage provider, cascade state machine, claim routes, worker sync, and UI smoke coverage.

### Explicitly Out of Scope Until Phase 4

- First-run setup wizard polish.
- Interactive `setup.sh` enhancements.
- Full provider settings UI polish.
- Relay connection UI.
- Relay authorization-code linking flow.
- TOTP setup UI polish.
- Full E2E browser automation.
- Production Docker image optimization.
- Public launch docs.

### Security Non-Negotiables

- Do not store credentials, passwords, crypto seed phrases, private keys, or 2FA backup codes in packets unless the user overrides with explicit warnings in a future phase.
- Do not log plaintext estate contents, contact details, packet contents, release keys, storage credentials, or claim tokens.
- Do not expose packet plaintext or packet keys before a claim reaches the required state.
- Claim tokens must be high entropy, single-purpose, rate-limited, and revocable through release cancellation.
- Key view/download events must require reauthentication where owner-side and claim verification where contact-side.
- Vault/Dead Drop modes must not imply guaranteed release if the host cannot execute release logic.

---

## Task 1: Verify and Extend Phase 3 Schema

**Goal:** Ensure schema supports packet generation, encrypted packet storage metadata, release runs, contact claims, escalation, key-view tracking, and audit-safe release execution.

**Files:**

- Update: `server/src/db/schema.ts`
- Update/Create: `server/drizzle/*.sql`
- Test: `server/tests/schema-phase3.test.ts`

- [ ] **Step 1: Confirm existing required tables**

Confirm these tables exist:

```text
owner
sessions
estate_items
contacts
switches
packets
contact_claims
release_runs
audit_events
app_settings or settings
local_acknowledgements
```

- [ ] **Step 2: Confirm packet fields**

The `packets` table should support:

```typescript
id
switchId
releaseRunId nullable
version
schemaVersion
encryptionAlgorithm
keyId
contentHash
encryptedObjectHash
localCiphertextPath nullable
storageProvider nullable
storageBucket nullable
storageObjectKey nullable
storageRegion nullable
storageVersionId nullable
lastVerifiedAt nullable
deletionStatus nullable
expiresAt nullable
createdAt
```

If missing, add a migration.

- [ ] **Step 3: Confirm contact claim fields**

The `contact_claims` table should support:

```typescript
id
releaseRunId
switchId
packetId
contactId
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
createdAt
```

If the current schema stores plaintext `claimToken`, replace it with `claimTokenHash`. Plain claim tokens should only be shown/generated at creation time and embedded in outbound notifications.

- [ ] **Step 4: Confirm release run fields**

The `release_runs` table should support:

```typescript
id
triggeringSwitchId
status
activePacketId nullable
currentContactClaimId nullable
suppressedSwitchIds JSON/text
metadata JSON/text, redacted only
startedAt
completedAt nullable
cancelledAt nullable
createdAt
updatedAt
```

- [ ] **Step 5: Add storage settings if missing**

Add or confirm settings keys for:

```text
s3_endpoint
s3_region
s3_bucket
s3_prefix
s3_access_key_id_encrypted
s3_secret_access_key_encrypted
s3_force_path_style
packet_retention_days
```

- [ ] **Step 6: Add migration tests**

Create `server/tests/schema-phase3.test.ts` to assert:

```text
packet fields exist
contact claim token hash exists
release run fields exist
storage setting keys can be persisted
no plaintext claim token column remains if migration updates it
```

- [ ] **Step 7: Run tests**

Run:

```bash
cd server && npm test -- schema-phase3.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/src/db/schema.ts server/drizzle server/tests/schema-phase3.test.ts
git commit -m "feat: extend schema for packets storage claims and release runs"
```

---

## Task 2: Update Shared Types and Contract Usage

**Goal:** Make packet, claim, release, storage, and audit types available to both server and web while using `packages/contracts` as the canonical DeadDrop boundary.

**Files:**

- Update: `packages/shared/src/types.ts`
- Update: `packages/contracts/src/packet-envelope.ts`
- Update: `packages/contracts/src/release-run.ts`
- Update: `packages/contracts/src/claim-event.ts`
- Update: `packages/contracts/src/storage-provider.ts`
- Test: `packages/contracts/tests/contracts.test.ts`

- [ ] **Step 1: Add shared packet types**

Add shared types:

```typescript
export type PacketStatus = 'draft' | 'generated' | 'uploaded' | 'verified' | 'deleted' | 'failed';
export type StorageProvider = 's3';

export interface PacketSummary {
  id: number;
  switchId: number;
  releaseRunId: number | null;
  version: number;
  schemaVersion: string;
  contentHash: string;
  encryptedObjectHash: string | null;
  storageProvider: StorageProvider | null;
  storageBucket: string | null;
  storageObjectKey: string | null;
  lastVerifiedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: Add release run types**

```typescript
export type ReleaseRunStatus = 'active' | 'cascade_active' | 'completed' | 'cancelled' | 'failed';

export interface ReleaseRunSummary {
  id: number;
  triggeringSwitchId: number;
  status: ReleaseRunStatus;
  activePacketId: number | null;
  currentContactClaimId: number | null;
  suppressedSwitchIds: number[];
  startedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}
```

- [ ] **Step 3: Add claim types**

```typescript
export interface ClaimPublicSummary {
  status: ClaimStatus;
  ownerDisplayName: string;
  contactDisplayName: string | null;
  switchName: string;
  expiresAt: string;
  acceptedAt: string | null;
  packetDownloadedAt: string | null;
  keyViewedAt: string | null;
  acknowledgedAt: string | null;
}
```

- [ ] **Step 4: Confirm contract schemas are versioned**

Confirm packet envelopes include:

```text
schemaVersion
packetId
sourceApp = aegis_core
createdAt
expiresAt
encryption metadata
contentHash
encryptedObjectHash
storage metadata
```

- [ ] **Step 5: Add contract tests**

Tests should validate:

```text
valid packet envelope parses
missing schemaVersion fails
invalid sourceApp fails
claim event schema supports opened/verified/accepted/downloaded/key_viewed/acknowledged
storage provider schema supports S3-compatible metadata
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared packages/contracts
git commit -m "feat: add packet release claim and storage shared contracts"
```

---

## Task 3: Implement Packet Crypto Service

**Goal:** Implement packet-level encryption distinct from field-level DB encryption.

**Files:**

- Create/Update: `server/src/services/packet-crypto.ts`
- Update: `server/src/services/crypto.ts`
- Test: `server/tests/packet-crypto.test.ts`

- [ ] **Step 1: Define packet crypto API**

Create service functions:

```typescript
export interface EncryptedPacketResult {
  keyId: string;
  algorithm: 'aes-256-gcm';
  iv: string;
  authTag: string;
  ciphertext: Buffer;
  contentHash: string;
  encryptedObjectHash: string;
}

export function generatePacketKey(): Buffer;
export function encryptPacketJson(packetJson: unknown, key: Buffer): EncryptedPacketResult;
export function decryptPacketJson(ciphertext: Buffer, key: Buffer, iv: string, authTag: string): unknown;
export function hashPlainPacket(packetJson: unknown): string;
export function hashEncryptedPacket(ciphertext: Buffer): string;
```

- [ ] **Step 2: Use AES-256-GCM**

Requirements:

```text
32-byte random packet key
12-byte random IV
16-byte auth tag
sha256 canonical JSON content hash
sha256 ciphertext hash
base64url encoding for envelope fields
```

- [ ] **Step 3: Add canonical JSON serialization**

Ensure packet hashes are deterministic for the same logical packet content.

- [ ] **Step 4: Add tests**

Test:

```text
encrypt/decrypt round trip
wrong key fails
modified ciphertext fails
modified auth tag fails
content hash deterministic
encrypted object hash changes with new IV
packet key is never logged
```

- [ ] **Step 5: Commit**

```bash
git add server/src/services/packet-crypto.ts server/src/services/crypto.ts server/tests/packet-crypto.test.ts
git commit -m "feat: implement packet encryption service"
```

---

## Task 4: Implement Packet Builder

**Goal:** Assemble selected estate items, contacts, owner instructions, and release metadata into a canonical legacy packet and encrypt it.

**Files:**

- Create: `server/src/services/packet-builder.ts`
- Create: `server/src/repositories/packet-repository.ts`
- Create: `server/tests/packet-builder.test.ts`

- [ ] **Step 1: Define packet payload shape**

The plaintext packet JSON should contain:

```typescript
interface LegacyPacketPayload {
  schemaVersion: string;
  generatedAt: string;
  sourceApp: 'aegis_core';
  owner: {
    displayName: string;
    email: string | null;
    timezone: string;
  };
  switch: {
    id: number;
    name: string;
    mode: string;
    deploymentMode: string;
  };
  estateItems: Array<{
    category: string;
    title: string;
    institutionName: string | null;
    accountType: string | null;
    referenceHint: string | null;
    assetDescription: string | null;
    locationNotes: string | null;
    executorNotes: string | null;
  }>;
  contacts: Array<{
    priorityOrder: number;
    fullName: string;
    relationship: string | null;
    email: string | null;
    phone: string | null;
    telegramHandle: string | null;
  }>;
  disclaimers: string[];
}
```

Do not include passwords, secrets, app settings, SMTP credentials, S3 credentials, session data, or field-encryption keys.

- [ ] **Step 2: Load and decrypt selected records**

Use existing field-encryption helpers to decrypt selected estate/contact fields only inside the packet builder.

- [ ] **Step 3: Validate selection**

Fail packet generation if:

```text
switch does not exist
switch has no selected estate items
switch has no selected contacts
selected records do not exist
packet payload contains disallowed secret-like fields
```

- [ ] **Step 4: Encrypt and persist packet metadata**

Persist:

```text
switchId
version
schemaVersion
encryptionAlgorithm
keyId
contentHash
encryptedObjectHash
localCiphertextPath or in-DB ciphertext reference
createdAt
expiresAt
```

Prefer storing encrypted packet bytes in a local data directory rather than directly in SQLite.

- [ ] **Step 5: Add tests**

Test:

```text
packet includes selected estate items and contacts
packet decrypts to expected payload
packet excludes unselected records
packet excludes credentials/settings
version increments per switch
generation writes redacted audit event
```

- [ ] **Step 6: Commit**

```bash
git add server/src/services/packet-builder.ts server/src/repositories/packet-repository.ts server/tests/packet-builder.test.ts
git commit -m "feat: build encrypted legacy packets from selected release data"
```

---

## Task 5: Implement Packet API Routes

**Goal:** Provide authenticated packet operations for generate/list/verify/delete without exposing plaintext packet data in ordinary UI routes.

**Files:**

- Create/Update: `server/src/routes/packets.ts`
- Update: `server/src/index.ts`
- Test: `server/tests/packets-routes.test.ts`

- [ ] **Step 1: Add routes**

Implement:

```text
GET    /api/packets
GET    /api/packets/:id
POST   /api/switches/:id/packets/generate
POST   /api/packets/:id/verify
DELETE /api/packets/:id
```

- [ ] **Step 2: Enforce auth + CSRF**

All state-changing packet routes require owner auth + CSRF.

- [ ] **Step 3: Return metadata only**

Packet list/detail routes should return metadata only:

```text
id
switchId
version
schemaVersion
contentHash
encryptedObjectHash
storage status
lastVerifiedAt
createdAt
expiresAt
```

Do not return plaintext packet contents.

- [ ] **Step 4: Add tests**

Test:

```text
unauthenticated access denied
generate requires CSRF
generate creates packet metadata
list returns metadata only
delete removes local encrypted object and marks deletion status
```

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/packets.ts server/src/index.ts server/tests/packets-routes.test.ts
git commit -m "feat: add authenticated packet management routes"
```

---

## Task 6: Implement S3-Compatible Storage Provider

**Goal:** Upload, verify, download, and delete encrypted packets in any S3-compatible object store.

**Files:**

- Update: `server/package.json`
- Create: `server/src/services/storage/s3-storage.ts`
- Create: `server/src/services/storage/index.ts`
- Test: `server/tests/storage-s3.test.ts`

- [ ] **Step 1: Add dependency**

Add AWS SDK v3 modules:

```bash
cd server && npm install @aws-sdk/client-s3 @aws-sdk/lib-storage
```

- [ ] **Step 2: Define provider interface**

```typescript
export interface PacketStorageProvider {
  uploadPacket(input: UploadPacketInput): Promise<UploadPacketResult>;
  verifyPacket(input: VerifyPacketInput): Promise<VerifyPacketResult>;
  downloadPacket(input: DownloadPacketInput): Promise<Buffer>;
  deletePacket(input: DeletePacketInput): Promise<void>;
}
```

- [ ] **Step 3: Implement S3 provider**

Support:

```text
endpoint
region
bucket
prefix
access key ID
secret access key
force path style
```

Use object key format:

```text
<configured-prefix>/<switch-id>/<packet-version>/<packet-id>.aegis.enc
```

- [ ] **Step 4: Verify after upload**

After upload:

```text
HEAD object
compare content length
store ETag/versionId if present
recompute/compare encryptedObjectHash where possible
```

- [ ] **Step 5: Add safe logging**

Do not log:

```text
access key ID
secret access key
bucket if user marks private? Prefer redacted bucket in audit metadata
object body
packet key
```

- [ ] **Step 6: Add tests with mocked S3 client**

Test:

```text
upload calls PutObject with encrypted bytes
verify calls HeadObject and returns status
missing object returns failed verification
delete calls DeleteObject
credentials are not logged
```

- [ ] **Step 7: Commit**

```bash
git add server/package.json package-lock.json server/src/services/storage server/tests/storage-s3.test.ts
git commit -m "feat: add s3-compatible packet storage provider"
```

---

## Task 7: Implement Dead Drop Sync Service and Worker Integration

**Goal:** Sync latest encrypted packet to configured S3-compatible storage while the owner is alive.

**Files:**

- Create: `server/src/services/dead-drop-sync.ts`
- Update: `server/src/worker/index.ts`
- Test: `server/tests/dead-drop-sync.test.ts`
- Test: `server/tests/worker-dead-drop.test.ts`

- [ ] **Step 1: Define sync behavior**

Dead Drop sync should run:

```text
immediately after packet generation
when a switch is armed in dead_drop / relay_monitoring / relay_escrow mode
periodically while switch remains armed
when selected estate/contact data changes for an armed switch
before entering warning mode if packet is stale
```

- [ ] **Step 2: Define staleness logic**

A packet is stale if:

```text
no packet exists for armed switch
selected estate/contact data changed after packet generation
last verified upload failed
last verified upload older than configured max age
```

- [ ] **Step 3: Implement `syncPacketForSwitch`**

```typescript
export async function syncPacketForSwitch(switchId: number): Promise<DeadDropSyncResult>
```

Behavior:

```text
generate packet if stale
upload encrypted packet
verify upload
update packet storage metadata
update switch.lastPacketSyncAt
write audit event
```

- [ ] **Step 4: Integrate worker**

Worker should call dead-drop sync for armed switches with deployment modes:

```text
dead_drop
relay_monitoring
relay_escrow
```

Do not require S3 sync for Vault Mode.

- [ ] **Step 5: Failure behavior**

If upload/verify fails:

```text
write redacted audit event
mark packet upload failed
surface degraded storage status in dashboard
prevent arming if readiness requires storage and storage is failing
```

- [ ] **Step 6: Add tests**

Test:

```text
armed dead_drop switch generates and uploads packet
vault switch does not upload
failed upload does not crash worker
successful upload updates lastPacketSyncAt
stale packet regenerates
fresh packet is not regenerated unnecessarily
```

- [ ] **Step 7: Commit**

```bash
git add server/src/services/dead-drop-sync.ts server/src/worker/index.ts server/tests/dead-drop-sync.test.ts server/tests/worker-dead-drop.test.ts
git commit -m "feat: sync encrypted packets to dead drop storage"
```

---

## Task 8: Implement Release Run Service

**Goal:** Start exactly one active release run when a switch triggers and attach/suppress subsequent triggers according to the release-run constraint.

**Files:**

- Create: `server/src/services/release-run.ts`
- Create: `server/src/repositories/release-run-repository.ts`
- Update: `server/src/services/switch-engine.ts`
- Test: `server/tests/release-run.test.ts`

- [ ] **Step 1: Define service API**

```typescript
export async function startOrAttachReleaseRun(input: {
  triggeringSwitchId: number;
  reason: 'trip_triggered' | 'heartbeat_missed' | 'manual_test';
}): Promise<ReleaseRunStartResult>;
```

- [ ] **Step 2: Enforce one active run**

If no active run exists:

```text
create release run
set triggering switch to triggered/cascade_active as appropriate
generate/sync active packet
write audit event
```

If active run exists:

```text
append triggering switch ID to suppressedSwitchIds
write audit event
return existing release run
DO NOT start second cascade
```

- [ ] **Step 3: Integrate switch engine**

When switch engine detects trigger condition, call release-run service instead of directly transitioning into cascade behavior.

- [ ] **Step 4: Add tests**

Test:

```text
first triggered switch creates release run
second triggered switch attaches to active run
no duplicate cascade starts
completed run allows a later new run
cancelled run allows a later new run
suppression metadata contains no PII
```

- [ ] **Step 5: Commit**

```bash
git add server/src/services/release-run.ts server/src/repositories/release-run-repository.ts server/src/services/switch-engine.ts server/tests/release-run.test.ts
git commit -m "feat: add release run service with single active run constraint"
```

---

## Task 9: Implement Contact Cascade Service

**Goal:** Execute ordered contact cascade for an active release run.

**Files:**

- Create: `server/src/services/cascade.ts`
- Create: `server/src/repositories/contact-claim-repository.ts`
- Update: `server/src/services/notifications.ts`
- Test: `server/tests/cascade.test.ts`

- [ ] **Step 1: Define cascade stages**

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

- [ ] **Step 2: Start cascade**

For the first selected contact by priority:

```text
create claim record
store claim token hash
send notification with claim URL
set notifiedAt
write audit event
```

- [ ] **Step 3: Generate claim URL**

Format:

```text
<appUrl>/claim/<claim-token>
```

Only the token appears in URL. The database stores only a hash.

- [ ] **Step 4: Escalate on timeout**

If current contact does not acknowledge within `confirmationWindowHours`:

```text
mark current claim escalated
create next contact claim
send notification to next contact
write audit event
```

- [ ] **Step 5: Complete cascade**

Release run completes only when a contact:

```text
accepts responsibility
views/downloads packet
views key or receives key according to local release policy
acknowledges receipt
```

- [ ] **Step 6: Failure behavior**

If all contacts fail/expire:

```text
mark release run failed
mark switch failed
write audit event
```

- [ ] **Step 7: Add tests**

Test:

```text
cascade starts with first priority contact
claim token stored hashed
notification sent with claim URL
no plaintext contact details in audit metadata
cascade escalates after timeout
cascade completes after acknowledgement
cascade fails after all contacts fail
```

- [ ] **Step 8: Commit**

```bash
git add server/src/services/cascade.ts server/src/repositories/contact-claim-repository.ts server/src/services/notifications.ts server/tests/cascade.test.ts
git commit -m "feat: implement ordered contact cascade"
```

---

## Task 10: Implement Public Claim API Routes

**Goal:** Allow a trusted contact to open, verify, accept, download packet, view release key, and acknowledge receipt.

**Files:**

- Create/Update: `server/src/routes/claim.ts`
- Update: `server/src/index.ts`
- Test: `server/tests/claim-routes.test.ts`

- [ ] **Step 1: Add public routes**

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

- [ ] **Step 2: Validate token hash**

Hash incoming token and compare to stored claim token hash.

- [ ] **Step 3: Add claim verification**

For Phase 3, support claim PIN if configured:

```text
claimPinHash on contact
POST /verify with pin
rate limit failed attempts
```

If no PIN is configured, require explicit confirmation form before accept.

- [ ] **Step 4: Packet download behavior**

Only allow packet download after:

```text
claim status is accepted or later
claim is not expired/escalated/failed
release run is active/cascade_active
```

Return encrypted packet by default, plus clear explanation. If local key release policy allows plaintext, keep plaintext display out of Phase 3 unless explicitly implemented with strong warnings.

- [ ] **Step 5: Key view behavior**

For local release key display:

```text
require verified + accepted claim
record keyViewedAt
write audit event
show key once per view with warning
```

Do not log key material.

- [ ] **Step 6: Acknowledge behavior**

Acknowledgement sets:

```text
claim.acknowledgedAt
claim.status = acknowledged
releaseRun.status = completed
switch.status = completed
```

- [ ] **Step 7: Add tests**

Test:

```text
invalid token returns generic 404
expired claim denied
claim open updates openedAt
wrong PIN rate limited
accept updates acceptedAt
packet before accept denied
packet after accept allowed
key view audited without key logging
acknowledge completes release run
```

- [ ] **Step 8: Commit**

```bash
git add server/src/routes/claim.ts server/src/index.ts server/tests/claim-routes.test.ts
git commit -m "feat: add public claim flow api"
```

---

## Task 11: Integrate Cascade Into Worker

**Goal:** Make worker progress active release runs, start cascades, escalate timed-out claims, and complete/fail release runs.

**Files:**

- Update: `server/src/worker/index.ts`
- Update: `server/src/services/cascade.ts`
- Test: `server/tests/worker-cascade.test.ts`

- [ ] **Step 1: Add worker release loop**

Worker should:

```text
find active release runs
ensure active packet exists
start cascade if no current claim exists
check current claim timeout
escalate if needed
complete release run when claim acknowledged
fail release run if cascade exhausted
```

- [ ] **Step 2: Ensure idempotency**

Repeated worker ticks must not:

```text
send duplicate notifications for same claim
create duplicate claims
regenerate packets unnecessarily
start parallel cascades
```

- [ ] **Step 3: Add lock/guard behavior**

Use DB fields/timestamps to avoid duplicate execution across overlapping worker ticks.

- [ ] **Step 4: Add tests**

Test:

```text
worker starts cascade for new release run
worker does not duplicate notification on second tick
worker escalates expired claim
worker completes acknowledged run
worker fails exhausted cascade
```

- [ ] **Step 5: Commit**

```bash
git add server/src/worker/index.ts server/src/services/cascade.ts server/tests/worker-cascade.test.ts
git commit -m "feat: progress release cascades from worker"
```

---

## Task 12: Implement Release API and Audit API

**Goal:** Provide owner-facing release status and audit visibility.

**Files:**

- Create/Update: `server/src/routes/release.ts`
- Create/Update: `server/src/routes/audit.ts`
- Update: `server/src/index.ts`
- Test: `server/tests/release-routes.test.ts`
- Test: `server/tests/audit-routes.test.ts`

- [ ] **Step 1: Add release routes**

Implement:

```text
GET  /api/release/status
GET  /api/release/runs
GET  /api/release/runs/:id
POST /api/release/runs/:id/cancel
POST /api/release/simulate
```

`simulate` should validate the flow without sending real notifications unless a test flag is explicitly provided.

- [ ] **Step 2: Add audit routes**

Implement:

```text
GET /api/audit-log
GET /api/audit-log/export
```

- [ ] **Step 3: Redact audit metadata**

Ensure audit responses do not include:

```text
contact email/phone/name
institution names
packet plaintext
release key material
claim tokens
storage credentials
```

- [ ] **Step 4: Add tests**

Test:

```text
release status returns active release summary
cancel active run marks run and switch cancelled
simulate does not send real notification by default
audit log requires auth
audit log excludes PII
```

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/release.ts server/src/routes/audit.ts server/src/index.ts server/tests/release-routes.test.ts server/tests/audit-routes.test.ts
git commit -m "feat: add release status and audit log api"
```

---

## Task 13: Implement Claim Portal UI

**Goal:** Build a clean public claim portal for contacts.

**Files:**

- Create: `web/src/pages/claim/ClaimLanding.tsx`
- Create: `web/src/pages/claim/ClaimVerify.tsx`
- Create: `web/src/pages/claim/ClaimAccept.tsx`
- Create: `web/src/pages/claim/ClaimDownload.tsx`
- Create: `web/src/pages/claim/ClaimAcknowledge.tsx`
- Update: `web/src/App.tsx`
- Update: `web/src/lib/api.ts`

- [ ] **Step 1: Add claim route group**

Add public routes:

```text
/claim/:token
/claim/:token/verify
/claim/:token/accept
/claim/:token/download
/claim/:token/acknowledge
```

- [ ] **Step 2: Claim landing**

Show:

```text
owner display name
plain-language explanation
claim expiration
current status
continue button
```

Do not show packet data yet.

- [ ] **Step 3: Verification screen**

Support claim PIN entry if required.

- [ ] **Step 4: Accept screen**

Require contact to confirm:

```text
I understand I may receive sensitive estate instructions.
I will handle this information responsibly.
```

- [ ] **Step 5: Download/key screen**

Show packet download and key-view actions only when API says allowed.

- [ ] **Step 6: Acknowledge screen**

Require final acknowledgement after packet/key access.

- [ ] **Step 7: Error states**

Handle:

```text
invalid token
expired claim
already escalated
already acknowledged
server unavailable
```

- [ ] **Step 8: Commit**

```bash
git add web/src/pages/claim web/src/App.tsx web/src/lib/api.ts
git commit -m "feat: add public claim portal ui"
```

---

## Task 14: Implement Release Page and Packet Status UI

**Goal:** Add owner-facing release management: packet status, dead-drop sync status, active release run, cascade status, and deployment-mode limitations.

**Files:**

- Create/Update: `web/src/pages/Release.tsx`
- Create: `web/src/components/release/PacketStatusCard.tsx`
- Create: `web/src/components/release/ReleaseRunCard.tsx`
- Create: `web/src/components/release/CascadeStatusCard.tsx`
- Create: `web/src/components/release/DeploymentModeWarning.tsx`
- Update: `web/src/App.tsx`

- [ ] **Step 1: Add Release page route**

Route:

```text
/release
```

- [ ] **Step 2: Show packet status**

Display:

```text
latest packet version
created at
storage provider
last sync
last verification
hash/version metadata
```

- [ ] **Step 3: Show release run status**

Display:

```text
active/completed/cancelled/failed run
triggering switch
current claim status
suppressed switches
```

- [ ] **Step 4: Show deployment warnings**

Examples:

```text
Vault Mode: local planning only; automated release may fail if host is offline.
Dead Drop: packet survives host loss, but local app may still be required for release/key flow.
Relay modes: connect SaaS relay in Phase 4+.
```

- [ ] **Step 5: Add manual actions**

Support:

```text
generate packet
sync packet
verify storage
cancel release run
simulate release flow
```

All state-changing actions require CSRF.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/Release.tsx web/src/components/release web/src/App.tsx
git commit -m "feat: add release and packet status ui"
```

---

## Task 15: Implement Audit Log UI

**Goal:** Let the owner inspect release, packet, notification, claim, worker, and storage events without exposing PII.

**Files:**

- Create/Update: `web/src/pages/AuditLog.tsx`
- Create: `web/src/components/audit/AuditEventRow.tsx`
- Update: `web/src/App.tsx`

- [ ] **Step 1: Add Audit Log route**

Route:

```text
/audit-log
```

- [ ] **Step 2: Display event list**

Columns:

```text
time
event type
actor type
switch/release reference
status/channel
redacted metadata
```

- [ ] **Step 3: Add filters**

Filter by:

```text
event type
actor type
switch
release run
packet
claim lifecycle
```

- [ ] **Step 4: Add export button**

Export redacted audit JSON/CSV.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/AuditLog.tsx web/src/components/audit web/src/App.tsx
git commit -m "feat: add redacted audit log ui"
```

---

## Task 16: Update Dashboard for Phase 3 Status

**Goal:** Surface packet/dead-drop/release/cascade health on the dashboard.

**Files:**

- Update: `server/src/routes/dashboard.ts`
- Update: `web/src/pages/Dashboard.tsx`
- Test: `server/tests/dashboard-phase3.test.ts`

- [ ] **Step 1: Extend dashboard API**

Add:

```text
latestPacket
storageStatus
activeReleaseRun
currentClaim
lastAuditEvents
```

- [ ] **Step 2: Update dashboard UI**

Add cards:

```text
Packet Ready / Missing / Stale
Dead Drop Synced / Failing / Not Configured
Active Release Run
Current Cascade Step
Recent Release Activity
```

- [ ] **Step 3: Add tests**

Test API response for:

```text
no packet yet
packet synced
storage failed
active release run
```

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/dashboard.ts web/src/pages/Dashboard.tsx server/tests/dashboard-phase3.test.ts
git commit -m "feat: show packet and release status on dashboard"
```

---

## Task 17: Documentation Updates

**Goal:** Document packet, storage, and release behavior clearly before Phase 4 polish.

**Files:**

- Create/Update: `docs/dead-drop.md`
- Create/Update: `docs/release-flow.md`
- Create/Update: `docs/key-management.md`
- Create/Update: `docs/storage-setup.md`
- Create/Update: `docs/threat-model.md`

- [ ] **Step 1: Document Dead Drop**

Explain:

```text
what gets uploaded
what does not get uploaded
how encryption works
what happens if local host is offline
limitations of Dead Drop without Relay Escrow
```

- [ ] **Step 2: Document claim flow**

Explain contact steps:

```text
notification
verification
acceptance
packet download
key view
acknowledgement
escalation
```

- [ ] **Step 3: Document key model**

For OSS Phase 3:

```text
local key release only
no Shamir
no zero-knowledge claim
packet key material never logged
```

- [ ] **Step 4: Commit**

```bash
git add docs/dead-drop.md docs/release-flow.md docs/key-management.md docs/storage-setup.md docs/threat-model.md
git commit -m "docs: document dead drop packet and claim release model"
```

---

## Task 18: End-to-End Phase 3 Verification

**Goal:** Verify Phase 3 behavior as a complete release flow.

**Files:**

- Create: `server/tests/phase3-flow.test.ts`
- Update: `README.md` if useful

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Add integration flow test**

Test:

```text
owner exists
estate items exist
contacts exist
switch is armed in Dead Drop mode
packet is generated
encrypted packet is uploaded/verified through mocked S3
switch triggers
release run starts
first contact claim created
claim opened/verified/accepted
packet downloaded
key viewed
claim acknowledged
release run completed
switch completed
audit log contains redacted events only
```

- [ ] **Step 3: Manual smoke test**

Run app and verify:

```text
Dashboard shows packet/dead-drop status
Release page can generate packet
Release page can sync/verify packet
Worker starts release run after trigger
Claim portal opens from notification link
Audit log displays claim/release events
```

- [ ] **Step 4: Build Docker image**

```bash
docker compose build
```

Expected: Build succeeds.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "test: verify phase 3 packet dead drop and cascade flow"
```

---

## Phase 3 Completion Checklist

Phase 3 is complete when:

- [ ] Packet crypto service is implemented and tested.
- [ ] Packet builder creates encrypted canonical packets.
- [ ] Packet routes expose metadata-only owner operations.
- [ ] S3-compatible storage provider uploads/verifies/deletes packets.
- [ ] Dead Drop sync runs from worker and after packet generation.
- [ ] Release run service enforces one active release run.
- [ ] Contact cascade starts, escalates, completes, and fails correctly.
- [ ] Public claim API supports open, verify, accept, download, key view, and acknowledge.
- [ ] Claim portal UI is functional.
- [ ] Release page shows packet, storage, release, and cascade status.
- [ ] Audit log API/UI display redacted events only.
- [ ] Dashboard surfaces packet/dead-drop/release health.
- [ ] Docs explain Dead Drop, packet encryption, and claim flow limitations.
- [ ] Full test suite passes.

---

## Handoff Notes for Phase 4

Phase 4 should build on this by adding:

- first-run setup wizard polish;
- interactive `setup.sh`;
- full Settings page for storage/notification/relay;
- deployment mode selector page;
- health dashboard for provider status checks;
- test mode to simulate full cascade without real notifications;
- TOTP setup UI;
- end-to-end browser tests;
- README/self-hosting docs;
- Docker image optimization;
- GitHub repo and AGPL publication polish.
