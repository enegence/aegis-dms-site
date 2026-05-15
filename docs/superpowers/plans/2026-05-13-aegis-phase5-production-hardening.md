# Aegis DMS — Phase 5: Production Hardening & Beta Readiness

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` recommended, or `superpowers:executing-plans`, to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the completed Phase 1–4 alpha implementation of Aegis Core and Aegis DMS Site from “feature-complete alpha” to “private beta-ready.” This phase does not add major new product surfaces. It hardens the existing OSS, Relay, and Hosted implementations so they are safer, testable, observable, recoverable, documented, and ready for controlled real-user testing.

**Assumption:** Phases 1–4 are complete in both repos:

- Aegis Core has auth, estate/contact CRUD, switches, readiness gates, notifications, worker loop, packets, S3 Dead Drop, contact cascade, claim portal, setup wizard, settings, deployment modes, TOTP, docs, and E2E tests.
- Aegis DMS Site has auth, billing, pricing, hosted CRUD, Relay heartbeat/status, hosted packets/storage/notifications/cascade, Relay-assisted flows, claim portal, admin basics, onboarding, billing management, Railway deployment, and E2E tests.

**Architecture:** Two repos remain separate:

- `aegis/` — AGPL-3.0 self-hosted Aegis Core.
- `aegis-dms-site/` — proprietary Aegis Relay + Aegis Hosted SaaS.

**DeadDrop positioning in this phase:**

- **DeadDrop Protocol** and **DeadDrop Engine** remain core internal architecture.
- **Public DeadDrop API** is not implemented in Phase 5.
- Phase 5 ensures the existing packet, release-run, heartbeat, claim, storage, notification, audit, and webhook concepts are stable enough that Phase 7/8 can expose them externally without major rewrite.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, SQLite, PostgreSQL, React, Vite, Tailwind CSS, Vitest, Playwright, Node crypto, Argon2, Stripe, Postmark, Docker, Railway, R2/S3-compatible storage.

**Parent plan:** `2026-05-06-aegis-master-plan.md`

**Prior phase docs:**

- `2026-05-08-aegis-oss-phase2.md`
- `2026-05-08-aegis-dms-site-phase2.md`
- `2026-05-08-aegis-oss-phase3.md`
- `2026-05-08-aegis-dms-site-phase3.md`
- `2026-05-08-aegis-oss-phase4.md`
- `2026-05-08-aegis-dms-site-phase4.md`

> **Note on phase labels:** Phase labels are sequencing guidance, not fixed delivery estimates. Implementation should optimize for correctness, security, recoverability, and trust over calendar targets.

---

## Phase 5 Scope

Phase 5 is a hardening phase.

It should produce:

1. A completed security/threat-model pass for OSS and SaaS.
2. Hardened release-run, packet, claim, and worker idempotency.
3. Backup/restore and disaster-recovery paths.
4. Observability and operational dashboards/logging.
5. Notification retry/backoff and delivery-state tracking.
6. Account export/deletion and data-retention flows.
7. Production-safe email templates.
8. Support/admin workflows that do not leak sensitive data.
9. Beta readiness documentation.
10. A clean “known limitations” document before external users test the product.
11. Real OSS Relay auth-code linking with SaaS.
12. Accessibility polish on setup/auth/settings/claim/admin flows.
13. Real production deployment, DNS, rollback, and operational alerting for SaaS.
14. Public release packaging for OSS and beta launch packaging for SaaS.

Phase 5 should **not** implement:

- public DeadDrop API;
- partner developer portal;
- SDK publishing;
- SAML/SSO/SCIM;
- SOC 2 certification;
- full Helper Pack content system;
- advanced zero-knowledge/key-splitting protocols.

Those belong to later phases.

---

## Phase 4 Carryover Alignment

This Phase 5 document is the authoritative place to absorb the unfinished or next-phase items alluded to by the OSS and SaaS Phase 4 plans, while staying consistent with the master plan and `update.md`.

### OSS carryovers from `2026-05-08-aegis-oss-phase4.md`

Phase 5 must explicitly cover:

```text
- Relay authorization-code connection flow with SaaS
- more provider integrations
- better backup/export tooling
- accessibility polish
- more failure-mode tests
- security review
- public release packaging
```

### SaaS carryovers from `2026-05-08-aegis-dms-site-phase4.md`

Phase 5 must explicitly cover:

```text
- real production deploy and DNS
- legal/terms/privacy pages
- support/contact flow
- more billing edge cases
- operational alerting
- better email templates
- security review
- Relay/Core integration testing with actual OSS instance
- DeadDrop API design preview docs
```

### Alpha carryovers called out in Phase 4 completion notes

The following items were surfaced in post-Phase-4 notes and must not get lost:

```text
- OSS TOTP recovery codes
- OSS password change flow
- claim/auth rate-limit hardening for sensitive routes
- Relay heartbeat hardening as idempotency/monitoring work, not a separate product surface
```

These are covered by Tasks 1, 2, 4, 5, 8, 10, and 11 below.

---

## Product/Architecture Reminder

Use the following model consistently:

```text
Aegis Core
  Open-source, self-hosted app.

Aegis Relay
  Paid SaaS feature for self-hosted users.

Aegis Hosted
  Fully managed SaaS app.

DeadDrop Protocol + DeadDrop Engine
  Internal architecture powering packets, release runs, heartbeats, claims, storage, notifications, and audit flows.

DeadDrop API
  Future external API/platform product. Not Phase 5.
```

Do not describe DeadDrop as “ignored” or “separate from the architecture.”

Correct phrasing:

```text
DeadDrop Protocol and DeadDrop Engine are core internal architecture now.
The public DeadDrop API product is implemented later.
```

---

# Task 1: Cross-Repo Security Review Baseline ✅

**Goal:** Establish a repeatable security-review baseline for both repos before beta testing.

**Repos:**

- `aegis/`
- `aegis-dms-site/`

**Files:**

- Create/Modify: `docs/security-review.md`
- Create/Modify: `docs/threat-model.md`
- Create/Modify: `docs/key-management.md`
- Create/Modify: `docs/release-modes.md`
- Create/Modify: `docs/security-checklist.md`
- Create/Modify: `server/tests/security-baseline.test.ts`

---

## Step 1: Create docs/security-checklist.md in both repos

Create `docs/security-checklist.md` with sections for:

```text
Authentication
Session management
CSRF protection
Password reset
TOTP
TOTP recovery codes
Password change
Field encryption
Packet encryption
Release-run authorization
Claim-token safety
Contact verification
Relay linking
API key handling
Audit log redaction
Admin-route authorization
Billing webhook validation
Storage credential handling
Notification payload minimization
Backup/export handling
Account deletion
Rate limiting
```

Each section should contain:

```text
Required behavior
Implemented files
Tests proving behavior
Manual review notes
Known limitations
```

---

## Step 2: Validate auth/session/CSRF controls

Review and document:

- cookies are HttpOnly;
- production cookies are Secure;
- SameSite policy is Lax or Strict;
- CORS is explicit allowlist in production;
- no wildcard CORS with credentials in production;
- CSRF required for POST/PUT/PATCH/DELETE;
- password reset tokens are hashed, single-use, and expiring;
- session expiration works;
- logout invalidates session;
- TOTP flows do not leak secret values;
- OSS TOTP recovery codes are generated, stored safely, and are one-time use;
- OSS password change requires current-password proof, auth, and CSRF;
- sensitive auth and public-claim routes have rate limiting or equivalent attempt throttling.

Add tests in both repos:

```text
server/tests/security-baseline.test.ts
```

Required test coverage:

```text
- state-changing request without CSRF is rejected
- invalid CSRF is rejected
- valid CSRF is accepted
- logout invalidates session
- expired session is rejected
- reset token cannot be reused
- reset token hash is stored, not plaintext
- production startup rejects default secrets
- recovery code can be used once and cannot be reused
- password change fails without current password
- claim PIN brute-force attempts are throttled
- login/TOTP brute-force attempts are throttled
```

---

## Step 3: Validate sensitive-data encryption

Confirm that plaintext database fields do not contain sensitive estate/contact metadata.

Required checks:

### OSS

Verify these are encrypted at rest:

```text
institutionName
accountType
referenceHint
assetDescription
locationNotes
executorNotes
fullName
relationship
email
phone
telegramHandle
backupNotes
```

### SaaS

Verify equivalent fields are encrypted at rest per user.

Required tests:

```text
- create estate item with sensitive fields
- query raw DB row
- assert sensitive values do not appear in plaintext
- fetch via API
- assert decrypted API response is correct
- create contact with sensitive fields
- query raw DB row
- assert sensitive values do not appear in plaintext
- fetch via API
- assert decrypted API response is correct
```

---

## Step 4: Validate audit log redaction

Audit logs must not contain:

```text
contact names
contact emails
contact phone numbers
institution names
account hints
executor notes
packet plaintext
release key material
storage credentials
API keys
Stripe secrets
Postmark tokens
```

Required tests:

```text
- trigger contact notification audit event
- assert metadata stores contactId/channel/status only
- trigger packet generation audit event
- assert no plaintext packet content appears
- trigger Relay heartbeat audit event
- assert no API key or sensitive health payload appears
- trigger claim download/key-view event
- assert no release key material appears
```

---

## Step 5: Commit

```bash
git add docs/security-checklist.md docs/security-review.md docs/threat-model.md docs/key-management.md docs/release-modes.md server/tests/security-baseline.test.ts
git commit -m "chore: establish phase 5 security review baseline"
```

---

# Task 2: Release-Run Idempotency & Recovery Hardening ✅

**Goal:** Ensure release runs cannot duplicate, fork, race, or corrupt state if workers restart, two triggers fire, or notifications fail.

**Repos:**

- `aegis/`
- `aegis-dms-site/`

**Files:**

- Modify: `server/src/services/release-run.ts`
- Modify: `server/src/services/switch-engine.ts`
- Modify: `server/src/services/cascade.ts`
- Modify: `server/src/worker/index.ts`
- Create/Modify: `server/tests/release-run-recovery.test.ts`
- Create/Modify: `server/tests/worker-idempotency.test.ts`

---

## Step 1: Add explicit release-run state transition guards

Define allowed transitions:

```text
pending → active
active → paused
active → completed
active → failed
active → cancelled
paused → active
paused → cancelled
failed → active only through explicit manual retry
completed → terminal
cancelled → terminal
```

Illegal transitions must fail with a typed error.

---

## Step 2: Enforce one active release run

Ensure service-level and database-level enforcement where practical.

Required behavior:

```text
Only one active release run may exist per owner/user.
If a second switch triggers while a release run is active, do not create a second cascade.
Attach or suppress the second trigger and audit it.
```

Required audit event:

```text
release_trigger_suppressed_by_active_run
```

Metadata may include:

```text
triggeringSwitchId
activeReleaseRunId
suppressedSwitchId
```

No plaintext PII.

---

## Step 3: Add idempotency keys to release actions

For release-run actions that may be retried, add idempotency keys:

```text
packet_generation:<switchId>:<packetVersion>
contact_notification:<releaseRunId>:<contactId>:<channel>
claim_state_transition:<claimId>:<from>:<to>
storage_upload:<packetId>:<version>
relay_heartbeat:<connectionId>:<timestamp-bucket>
```

Store processed idempotency keys in an `idempotency_keys` table or existing operational table.

Recommended OSS table:

```ts
export const idempotencyKeys = sqliteTable('idempotency_keys', {
  key: text('key').primaryKey(),
  scope: text('scope').notNull(),
  resultJson: text('result_json'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
});
```

Recommended SaaS table:

```ts
export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').primaryKey(),
  scope: text('scope').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  resultJson: jsonb('result_json'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
});
```

---

## Step 4: Worker restart recovery

Worker loop must recover from restart without duplicating work.

Required behavior:

```text
- active release run resumes from current state
- notified contacts are not notified twice unless retry policy says so
- completed claims remain completed
- expired claims escalate once
- packet uploads are verified before re-uploading
- missing packet upload triggers repair attempt
```

---

## Step 5: Tests

Create `server/tests/release-run-recovery.test.ts`.

Test cases:

```text
- active release run survives worker restart
- second switch trigger is suppressed while release run active
- completed release run is terminal
- failed release run can be manually retried
- cancelled release run cannot resume
- same contact notification is not sent twice on worker retry
- expired claim escalates once
- packet upload repair does not create duplicate packet versions
```

Create `server/tests/worker-idempotency.test.ts`.

Test cases:

```text
- duplicate worker tick does not duplicate notifications
- duplicate worker tick does not duplicate packet upload
- duplicate worker tick does not duplicate claim escalation
- idempotency keys expire when appropriate
```

---

## Step 6: Commit

```bash
git add server/src/services/release-run.ts server/src/services/switch-engine.ts server/src/services/cascade.ts server/src/worker/index.ts server/tests/release-run-recovery.test.ts server/tests/worker-idempotency.test.ts
git commit -m "fix: harden release-run idempotency and recovery"
```

---

# Task 3: Notification Delivery Reliability ✅

**Goal:** Make notification delivery reliable enough for beta users by adding retry, backoff, delivery-state tracking, and provider-specific failure handling.

**Repos:**

- `aegis/`
- `aegis-dms-site/`

**Files:**

- Modify: `server/src/services/notifications.ts`
- Modify: `server/src/services/cascade.ts`
- Modify: `server/src/worker/index.ts`
- Create/Modify: `server/src/db/schema.ts`
- Create/Modify: `server/tests/notification-retry.test.ts`
- Create/Modify: `server/tests/notification-payload.test.ts`

---

## Step 1: Add notification delivery table

Add table in both repos.

Required fields:

```text
id
releaseRunId
claimId
contactId
channel
provider
status
attemptCount
lastAttemptAt
nextAttemptAt
providerMessageId
lastErrorCode
lastErrorMessageRedacted
payloadHash
createdAt
updatedAt
```

Status values:

```text
queued
sending
sent
delivered
failed_retryable
failed_permanent
cancelled
```

Do not store plaintext message body in this table.

---

## Step 2: Add retry policy

Default policy:

```text
attempt 1: immediate
attempt 2: +5 minutes
attempt 3: +30 minutes
attempt 4: +2 hours
attempt 5: +12 hours
then failed_permanent
```

Provider-specific permanent failures:

```text
invalid email
blocked address
unsubscribed/complained recipient
invalid Telegram chat/user
```

Provider-specific retryable failures:

```text
timeout
rate limit
provider unavailable
5xx response
network error
```

---

## Step 3: Add notification payload minimization

Notification messages should contain only what contacts need.

Do not include:

```text
packet plaintext
institution names
account details
release key material
full estate inventory
```

Allowed:

```text
owner display name
high-level message
claim link
claim expiration
support/contact instructions
```

---

## Step 4: SaaS Postmark event ingestion

In SaaS repo only, add a Postmark webhook endpoint if not already present.

Create/modify:

```text
server/src/routes/postmark-webhook.ts
server/src/services/postmark-events.ts
server/tests/postmark-webhook.test.ts
```

Handle:

```text
Delivery
Bounce
SpamComplaint
Open optional, but do not rely on it for critical state
```

Webhook must validate provider authenticity where supported.

---

## Step 5: Tests

Required tests:

```text
- queued notification is sent
- retryable failure schedules retry
- permanent failure does not retry
- max attempts marks failed_permanent
- duplicate worker tick does not send duplicate notification
- notification payload does not include estate details
- SaaS Postmark bounce updates delivery record
- SaaS Postmark complaint marks permanent failure
```

---

## Step 6: Commit

```bash
git add server/src/services/notifications.ts server/src/services/cascade.ts server/src/worker/index.ts server/src/db/schema.ts server/tests/notification-retry.test.ts server/tests/notification-payload.test.ts
git commit -m "feat: notification delivery tracking with retry and payload minimization"
```

---

# Task 4: Backup, Export, Restore, and Deletion ✅

**Goal:** Give users and operators a safe path to export, restore, and delete data before beta.

**Repos:**

- `aegis/`
- `aegis-dms-site/`

**Files:**

- Create/Modify: `server/src/services/export.ts`
- Create/Modify: `server/src/services/backup.ts`
- Create/Modify: `server/src/routes/export.ts`
- Create/Modify: `server/src/routes/account.ts`
- Create/Modify: `web/src/pages/Settings.tsx`
- Create/Modify: `web/src/pages/app/Settings.tsx` in SaaS
- Create/Modify: `docs/backup-restore.md`
- Create/Modify: `server/tests/export.test.ts`
- Create/Modify: `server/tests/account-deletion.test.ts`

---

## Step 1: OSS encrypted export

Add export flow:

```text
POST /api/export
```

Behavior:

```text
- requires reauthentication
- creates encrypted export bundle
- includes owner profile, estate items, contacts, switches, packets metadata, settings, audit metadata
- excludes active sessions
- excludes raw secrets unless user explicitly selects configuration export
- export is encrypted with user-provided passphrase
- export includes schema version
```

Export bundle shape:

```json
{
  "schemaVersion": "aegis-export-2026-05-01",
  "createdAt": "ISO",
  "appVersion": "0.1.0",
  "encryption": {
    "algorithm": "aes-256-gcm",
    "kdf": "argon2id",
    "salt": "base64",
    "iv": "base64",
    "authTag": "base64"
  },
  "payloadHash": "sha256",
  "encryptedPayload": "base64"
}
```

---

## Step 2: OSS restore validation

Add restore preview flow:

```text
POST /api/export/preview-restore
POST /api/export/restore
```

Behavior:

```text
- decrypt export with passphrase
- validate schema version
- show preview counts
- require explicit confirmation
- do not overwrite existing DB without warning
- create backup before restore
```

---

## Step 3: SaaS account export

Add:

```text
POST /api/account/export
```

Behavior:

```text
- requires active session
- requires reauthentication
- produces encrypted export bundle
- includes hosted estate/contact/switch/release metadata
- excludes Stripe secrets, session data, internal admin notes, provider tokens
- includes subscription summary but not payment method details
```

---

## Step 4: SaaS account deletion

Add deletion request flow:

```text
POST /api/account/request-deletion
POST /api/account/confirm-deletion
```

Behavior:

```text
- requires reauthentication
- sends confirmation email
- cancels active Stripe subscription or redirects to portal if needed
- marks account pending deletion
- stops active switches/release runs unless release already active
- after grace window, deletes or anonymizes user data according to retention policy
- logs non-sensitive deletion audit event
```

For alpha/beta, implement immediate deletion behind explicit confirmation if delayed deletion is not yet built, but document behavior.

---

## Step 5: Docs

Create `docs/backup-restore.md` in OSS.

Create SaaS docs page content:

```text
How to export your data
How account deletion works
What data is retained for billing/security/legal reasons
How to cancel subscriptions
How to download a backup before deletion
```

---

## Step 6: Tests

Required tests:

```text
- export requires reauth
- export bundle decrypts with correct passphrase
- export fails with wrong passphrase
- export does not contain plaintext sensitive data outside encrypted payload
- restore preview validates schema
- restore rejects invalid schema
- SaaS account export excludes provider secrets
- account deletion requires reauth
- account deletion cancels or flags subscription handling
- deleted account cannot log in
```

---

## Step 7: Commit

```bash
git add server/src/services/export.ts server/src/services/backup.ts server/src/routes/export.ts server/src/routes/account.ts web/src/pages/Settings.tsx docs/backup-restore.md server/tests/export.test.ts server/tests/account-deletion.test.ts
git commit -m "feat: encrypted export restore and account deletion flows"
```

---

# Task 5: Observability, Health, and Operational Readiness ✅

**Goal:** Make both apps observable enough to debug beta incidents without exposing sensitive data.

**Repos:**

- `aegis/`
- `aegis-dms-site/`

**Files:**

- Create/Modify: `server/src/services/health.ts`
- Create/Modify: `server/src/services/metrics.ts`
- Create/Modify: `server/src/routes/health.ts`
- Create/Modify: `server/src/routes/admin.ts` in SaaS
- Create/Modify: `server/src/logger.ts`
- Create/Modify: `docs/operations.md`
- Create/Modify: `server/tests/health.test.ts`
- Create/Modify: `server/tests/log-redaction.test.ts`

---

## Step 1: Structured logging with redaction

Ensure logs are JSON structured.

All logs should include:

```text
level
time
requestId
event
status
latencyMs optional
actorType optional
actorId optional
```

Logs must redact:

```text
passwords
session IDs
CSRF tokens
API keys
Stripe secrets
Postmark tokens
S3 secrets
packet plaintext
release key material
contact emails
contact phone numbers
institution names
```

---

## Step 2: Add detailed health endpoint

Public health:

```text
GET /health
```

Returns only:

```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

Authenticated/admin health:

```text
GET /api/health/details
```

OSS owner-only. SaaS admin-only.

Returns:

```text
database status
worker status
last worker tick
storage status
notification provider status
relay status
queue/delivery backlog
failed notification count
active release run count
pending claim count
```

No secrets or plaintext PII.

---

## Step 3: SaaS admin operational dashboard

In SaaS, extend admin dashboard with:

```text
active users
active subscriptions
relay connections online/offline
hosted active switches
active release runs
failed notifications
storage failures
worker lag
recent non-sensitive audit events
```

No direct access to decrypted user estate/contact content.

---

## Step 4: Worker heartbeat

Both repos should persist worker heartbeat:

```text
worker name
lastTickAt
lastSuccessAt
lastErrorAt
lastErrorRedacted
tickDurationMs
```

SaaS should expose this in admin health.

---

## Step 5: Operational alerting

Add operational alerts for beta-critical failures.

Required alert classes:

```text
- worker has not ticked within expected interval
- storage verification failures exceed threshold
- repeated notification delivery failures
- Stripe webhook processing failures
- Postmark webhook failures
- Relay monitor backlog or offline-processing lag
- release-run stuck active beyond expected threshold
```

Requirements:

```text
- OSS owner can see alert state in detailed health and dashboard warning surfaces
- SaaS admins can see alert state in admin health/dashboard
- SaaS may send operator alerts by email/webhook if configured
- alerts must not include secrets or plaintext PII
```

---

## Step 6: Tests

Required tests:

```text
- public health does not leak details
- detailed health requires auth/admin
- detailed health includes worker/storage/notification state
- logger redacts sensitive keys
- logger redacts nested sensitive payloads
- admin metrics do not include plaintext user PII
- alert state is raised for stale worker heartbeat
- alert state is raised for repeated delivery/storage failure
```

---

## Step 7: Commit

```bash
git add server/src/services/health.ts server/src/services/metrics.ts server/src/routes/health.ts server/src/logger.ts docs/operations.md server/tests/health.test.ts server/tests/log-redaction.test.ts
git commit -m "feat: operational health metrics and redacted structured logging"
```

---

# Task 6: SaaS Support, Billing, and Admin Hardening

**Goal:** Make SaaS safe to operate during beta without exposing sensitive data or leaving billing edge cases unresolved.

**Repo:**

- `aegis-dms-site/`

**Files:**

- Modify: `server/src/routes/admin.ts`
- Modify: `server/src/routes/billing.ts`
- Modify: `server/src/services/billing.ts`
- Modify: `server/src/services/admin.ts`
- Modify: `web/src/pages/admin/AdminDashboard.tsx`
- Create/Modify: `web/src/pages/admin/UserDetail.tsx`
- Create/Modify: `server/tests/admin.test.ts`
- Create/Modify: `server/tests/billing-lifecycle.test.ts`
- Create/Modify: `docs/support-runbook.md`

---

## Step 1: Admin role hardening

Ensure admin routes require admin authorization.

Add roles if not already present:

```text
user
admin
super_admin
```

If only one admin level exists for beta, document it.

Admin routes must not return decrypted estate/contact fields.

Allowed admin user detail fields:

```text
userId
email
displayName
emailVerified
subscription status
plan
createdAt
lastLoginAt
relay connection count
hosted switch count
active release run count
failed notification count
```

Disallowed:

```text
decrypted estate data
decrypted contact data
packet plaintext
release key material
claim token plaintext
provider credentials
```

---

## Step 2: Billing lifecycle hardening

Handle Stripe states:

```text
checkout completed
subscription active
trialing
past_due
unpaid
cancelled
paused
payment failed
invoice paid
invoice payment failed
customer deleted
```

Required behavior:

```text
- Relay/Hosted access reflects subscription state
- past_due shows warning but does not instantly destroy data
- cancelled stops future paid access after grace/current period
- subscription status changes are idempotent
- webhook replay is safe
```

---

## Step 3: Support runbook

Create `docs/support-runbook.md`.

Include:

```text
How to inspect account status
How to diagnose failed Relay connection
How to diagnose failed notification
How to resend verification email
How to guide user through export/deletion
What support must never ask for
What support cannot see
Escalation path for release incidents
Incident severity levels
```

Explicitly state:

```text
Support must never ask for passwords, TOTP codes, API keys, storage credentials, or packet/release keys.
```

---

## Step 4: Tests

Required tests:

```text
- non-admin cannot access admin routes
- admin route does not return decrypted PII
- billing webhook replay is idempotent
- past_due subscription limits paid features but preserves data
- cancelled subscription enters appropriate access state
- customer portal session requires auth
```

---

## Step 5: Commit

```bash
git add server/src/routes/admin.ts server/src/routes/billing.ts server/src/services/billing.ts server/src/services/admin.ts web/src/pages/admin/AdminDashboard.tsx web/src/pages/admin/UserDetail.tsx server/tests/admin.test.ts server/tests/billing-lifecycle.test.ts docs/support-runbook.md
git commit -m "feat: harden saas admin support and billing lifecycle"
```

---

# Task 7: Legal, Trust, and Public Safety Pages

**Goal:** Add the minimum production-facing trust/legal pages and UX disclosures needed for beta.

**Repo:**

- `aegis-dms-site/`

**OSS Repo:**

- Add docs references and links where appropriate.

**Files:**

- Create: `web/src/pages/marketing/Terms.tsx`
- Create: `web/src/pages/marketing/Privacy.tsx`
- Create: `web/src/pages/marketing/Security.tsx`
- Create: `web/src/pages/marketing/AcceptableUse.tsx`
- Create: `web/src/pages/marketing/Disclaimers.tsx`
- Create: `web/src/pages/marketing/DataDeletion.tsx`
- Create/Modify: `web/src/pages/marketing/Pricing.tsx`
- Create/Modify: `web/src/App.tsx`
- Create/Modify: `docs/legal-notes.md`
- Create/Modify: `server/tests/legal-pages.test.ts`

---

## Step 1: Add required legal/trust pages

Pages:

```text
/terms
/privacy
acceptable-use
/security
/disclaimers
/data-deletion
```

Each page should be clearly labeled as beta/legal placeholder if formal legal review has not happened yet.

Required concepts:

```text
Aegis is not a will.
Aegis is not legal advice.
Aegis does not guarantee asset transfer.
Aegis stores estate metadata/instructions, not credentials.
Users are responsible for accuracy.
Users must not store passwords, seed phrases, or illegal content.
Relay Escrow requires trust in Aegis SaaS.
Hosted is a managed trust model.
Data deletion/export behavior is explained.
Stripe handles payment information.
```

---

## Step 2: Add acceptance checkboxes where needed

On signup/onboarding, require acceptance of:

```text
Terms
Privacy Policy
Disclaimers
```

Before enabling Relay Escrow, require acceptance of Relay Escrow trust disclosure.

Before enabling Hosted release flows, require Hosted trust disclosure if not already accepted.

---

## Step 3: OSS legal/trust references

In OSS docs, add links to:

```text
Aegis Hosted terms
Aegis Relay terms
Security model
Privacy policy
```

Also clarify:

```text
Self-hosted Aegis Core is user-operated software.
The project maintainers do not receive self-hosted user data unless Relay/Hosted services are used.
```

---

## Step 4: Tests

Required tests:

```text
- legal pages render
- signup stores accepted terms version
- Relay Escrow cannot enable without trust acknowledgement
- Hosted release cannot enable without hosted trust acknowledgement
- pricing page links legal/disclaimer pages
```

---

## Step 5: Commit

```bash
git add web/src/pages/marketing/Terms.tsx web/src/pages/marketing/Privacy.tsx web/src/pages/marketing/Security.tsx web/src/pages/marketing/AcceptableUse.tsx web/src/pages/marketing/Disclaimers.tsx web/src/pages/marketing/DataDeletion.tsx web/src/pages/marketing/Pricing.tsx web/src/App.tsx docs/legal-notes.md server/tests/legal-pages.test.ts
git commit -m "feat: legal trust and safety pages for beta"
```

---

# Task 8: Beta E2E Test Matrix

**Goal:** Expand end-to-end coverage to realistic flows across OSS, Hosted, Relay Monitoring, and Relay Escrow.

**Repos:**

- `aegis/`
- `aegis-dms-site/`

**Files:**

- Create/Modify: `web/e2e/*.spec.ts`
- Create/Modify: `playwright.config.ts`
- Create/Modify: `docs/e2e-test-plan.md`
- Create/Modify: `.github/workflows/test.yml`

---

## Step 1: Add OSS E2E tests

Required flows:

```text
setup owner
login
create estate item
create contact
configure Vault Mode switch
configure Dead Drop switch with mocked storage
configure SMTP/Telegram with mocked provider
arm switch
check in
simulate trigger
claim flow
export backup
restore preview
```

---

## Step 2: Add SaaS E2E tests

Required flows:

```text
register
verify email
login
start checkout with mocked Stripe
subscription active via mocked webhook
create hosted estate item
create hosted contact
create hosted switch
arm hosted switch
simulate trigger
claim flow
billing portal link
account export
account deletion request
```

---

## Step 3: Add Relay E2E tests

Cross-repo or mocked integration tests:

```text
OSS connects to SaaS Relay using auth-code exchange
OSS sends heartbeat
SaaS marks relay connection active
missed heartbeat marks offline
Relay Monitoring alerts owner/contact path
Relay Escrow requires trust acknowledgement
Relay Escrow can execute fallback flow in mocked offline condition
```

At least one scheduled or release-gate test run must use a real OSS instance talking to the SaaS stack. Mocked Relay servers are acceptable for fast PR checks, but they must not be the only Relay/Core integration coverage in Phase 5.

If true always-on cross-repo E2E is too heavy for every PR, create a mocked SaaS Relay server for OSS tests and a mocked OSS heartbeat source for SaaS tests for the normal CI path, then keep a nightly/release-gate run with the real cross-repo stack.

---

## Step 4: CI integration

Update GitHub Actions:

```text
npm install
npm run build
npm test
npm run e2e
```

For SaaS, use service container Postgres.

For OSS, use temp SQLite DB.

Store screenshots/traces on failure.

---

## Step 5: Commit

```bash
git add web/e2e playwright.config.ts docs/e2e-test-plan.md .github/workflows/test.yml
git commit -m "test: expand beta end-to-end coverage"
```

---

# Task 9: Beta Documentation and Known Limitations

**Goal:** Make the alpha/beta boundary explicit so no user or operator misunderstands the reliability/trust model.

**Repos:**

- `aegis/`
- `aegis-dms-site/`

**Files:**

- Create/Modify: `README.md`
- Create/Modify: `docs/beta-readiness.md`
- Create/Modify: `docs/known-limitations.md`
- Create/Modify: `docs/release-checklist.md`
- Create/Modify: `docs/self-hosting.md`
- Create/Modify: `docs/relay.md`
- Create/Modify: `docs/hosted.md`
- Create/Modify: `docs/deaddrop-architecture.md`
- Create/Modify: `docs/deaddrop-api-preview.md`

---

## Step 1: Create known limitations doc

Create `docs/known-limitations.md`.

Include:

```text
No formal external security audit yet.
No production SLA yet.
No SMS support unless explicitly implemented.
No Shamir/key-splitting in alpha/beta.
No public DeadDrop API yet.
No SOC 2 / HIPAA / regulated compliance claims.
Relay Monitoring is not Relay Escrow.
Vault Mode is not guaranteed automated release.
Hosted requires trust in Aegis SaaS.
Users should not store passwords, seed phrases, or credentials.
```

---

## Step 2: Create release checklist

Create `docs/release-checklist.md`.

Include:

```text
All tests pass
E2E tests pass
Security checklist reviewed
Threat model updated
Known limitations updated
Legal pages live
Privacy policy live
Backup/export tested
Account deletion tested
Notification retry tested
Worker recovery tested
Release-run duplicate prevention tested
No plaintext PII in audit logs
No secrets in logs
Docker image builds
Railway deploy succeeds
Rollback path documented
```

---

## Step 3: Create DeadDrop architecture doc

Create `docs/deaddrop-architecture.md`.

Clarify:

```text
DeadDrop Protocol = contracts.
DeadDrop Engine = internal services.
DeadDrop API = future external platform product.
```

Include diagram:

```text
Aegis Core      Aegis Relay      Aegis Hosted
     \              |                /
      \             |               /
       └────── DeadDrop Engine ─────┘
                    |
          DeadDrop Protocol Contracts
                    |
       Future Public DeadDrop API Product
```

---

## Step 4: Create DeadDrop API preview doc

Create `docs/deaddrop-api-preview.md`.

The goal is not to ship a public API in Phase 5. The goal is to prevent architectural drift while OSS, Relay, and Hosted stabilize.

Document:

```text
- planned API product boundary
- likely resource model: packets, release-runs, heartbeats, claims, webhooks, storage providers, notification providers
- auth expectations at a high level
- what stays internal in Phase 5
- explicit statement that no external API compatibility is promised yet
```

---

## Step 5: Update README files

Both repos should include:

```text
What this is
What this is not
Deployment modes
Trust model
Known limitations
Security model
How to report vulnerabilities
How to run tests
How to deploy
How to back up/export/delete data
```

---

## Step 6: Commit

```bash
git add README.md docs/beta-readiness.md docs/known-limitations.md docs/release-checklist.md docs/self-hosting.md docs/relay.md docs/hosted.md docs/deaddrop-architecture.md docs/deaddrop-api-preview.md
git commit -m "docs: beta readiness known limitations and deaddrop architecture"
```

---

# Task 10: OSS Relay Linking, Provider Coverage, and Accessibility Polish

**Goal:** Close the OSS-specific carryovers from Phase 4 that are not fully addressed by hardening alone: real Relay linking, provider coverage, accessibility, and owner-facing account-security polish.

**Repos:**

- `aegis/`
- `aegis-dms-site/` for Relay linking endpoints needed by OSS

**Files:**

- Modify: `server/src/routes/relay.ts` in OSS
- Modify: `server/src/services/relay-client.ts` in OSS
- Modify: `web/src/components/settings/RelaySettings.tsx` in OSS
- Modify: `web/src/components/settings/SecuritySettings.tsx` in OSS
- Modify: `web/src/pages/Setup.tsx` in OSS
- Modify: `web/src/pages/Login.tsx` in OSS
- Modify: `web/src/pages/claim/*` in OSS
- Create/Modify: `server/src/routes/security.ts` in OSS
- Create/Modify: `server/tests/relay-linking.test.ts`
- Create/Modify: `server/tests/accessibility-smoke.test.ts`
- Create/Modify: `docs/accessibility.md`
- Modify: corresponding Relay auth-code/linking routes in `aegis-dms-site/` if needed

---

## Step 1: Implement real Relay authorization-code linking

Phase 4 left OSS with limited/stubbed Relay connection UX. Phase 5 must implement the real linking path.

Required behavior:

```text
- OSS initiates Relay connect flow with state + callback URL
- SaaS authenticates the user and issues short-lived auth code / link code
- OSS exchanges code server-to-server for Relay credentials
- OSS stores Relay credentials encrypted locally
- OSS never receives long-lived API secrets via browser URL
- unlink / rotate / reconnect flows are supported
- all linking events are audited without leaking secrets
```

---

## Step 2: Finish owner-facing security carryovers

Add the carryovers that were still placeholders or limitations after OSS Phase 4:

```text
- TOTP recovery codes: generate, show once, regenerate, disable on rotation, one-time use only
- owner password change flow in Settings
- rate-limit hardening for OSS login, login/TOTP challenge, and public claim PIN/verification routes
```

These are Phase 5 carryovers because they were either explicitly deferred or only partially implemented at the end of Phase 4.

---

## Step 3: Expand provider coverage within the master-plan boundaries

Do not add unrelated new product surfaces. Stay within the master-plan model:

```text
- OSS notifications remain SMTP + Telegram
- OSS storage remains S3-compatible
```

Phase 5 provider coverage means:

```text
- test/document common S3-compatible providers: AWS S3, Cloudflare R2, Backblaze B2 S3, MinIO
- test/document common SMTP deployment patterns and failure cases
- add provider-specific validation hints/presets where useful
- ensure provider test buttons and health checks produce redacted actionable errors
```

---

## Step 4: Accessibility polish for critical flows

At minimum, improve:

```text
- keyboard navigation and visible focus states
- semantic labels and descriptions for forms
- error-summary and inline-error associations
- color-contrast issues in setup/auth/settings/claim/admin views
- screen-reader announcements for async success/failure states
```

Priority pages:

```text
- OSS setup
- OSS login + TOTP challenge
- OSS settings tabs
- OSS public claim flow
- SaaS signup/login/onboarding
- SaaS admin critical views
```

---

## Step 5: Tests and docs

Required tests/docs:

```text
- OSS Relay auth-code exchange works end-to-end
- unlink/reconnect flow works without URL-secret leakage
- TOTP recovery code is one-time use
- owner password change works and writes audit event
- claim/login throttling rejects abusive repeated attempts
- accessibility smoke coverage exists for focus, labels, and error states
- docs/accessibility.md records current accessibility guarantees and known gaps
```

---

## Step 6: Commit

```bash
git add server/src/routes/relay.ts server/src/services/relay-client.ts web/src/components/settings/RelaySettings.tsx web/src/components/settings/SecuritySettings.tsx web/src/pages/Setup.tsx web/src/pages/Login.tsx web/src/pages/claim server/src/routes/security.ts server/tests/relay-linking.test.ts server/tests/accessibility-smoke.test.ts docs/accessibility.md
git commit -m "feat: complete relay linking accessibility and owner security carryovers"
```

---

# Task 11: Production Deployment, Email Templates, Alerting, and Release Packaging

**Goal:** Close the remaining SaaS and OSS Phase 4 carryovers around real deployment, support/contact reachability, operator alerting, public release packaging, and production-safe communications.

**Repos:**

- `aegis/`
- `aegis-dms-site/`

**Files:**

- Create/Modify: `railway.toml`
- Create/Modify: `docs/deployment.md`
- Create/Modify: `docs/operations.md`
- Create/Modify: `docs/release-checklist.md`
- Create/Modify: `docs/support-runbook.md`
- Create/Modify: `web/src/pages/marketing/Contact.tsx`
- Create/Modify: `web/src/App.tsx`
- Create/Modify: `server/src/services/email-templates.ts`
- Create/Modify: `server/src/services/alerts.ts`
- Create/Modify: `Dockerfile` in OSS if packaging changes require it
- Create/Modify: `.github/workflows/test.yml`
- Create/Modify: `.github/workflows/release.yml`
- Create/Modify: `server/tests/email-templates.test.ts`
- Create/Modify: `server/tests/deployment-readiness.test.ts`

---

## Step 1: Real SaaS production deployment and DNS

Phase 5 must include a concrete production deployment runbook, not just local/dev config.

Required deliverables:

```text
- Railway production environment shape documented
- custom domain and DNS records documented
- TLS/cookie/CORS/base URL settings validated for production domain
- environment separation for dev/staging/prod documented
- rollback procedure documented
- smoke-test checklist for post-deploy verification
```

---

## Step 2: Public support/contact flow

Add a user-facing support/contact path for beta:

```text
- marketing-site contact/support page
- support email/contact instructions in app and claim contexts where appropriate
- vulnerability-reporting path in docs
- escalation path for account/billing/release incidents
```

This complements the internal support runbook in Task 6.

---

## Step 3: Production-safe email templates

Phase 5 scope already calls for production-safe email templates. Implement them here.

Required template set:

```text
- verify email
- password reset
- claim notification
- claim escalation / reminder
- Relay offline alert
- billing state change / payment issue
- account deletion confirmation
```

Requirements:

```text
- plain-text and HTML versions where appropriate
- no plaintext secrets or over-sharing of estate data
- consistent branding/legal footer
- template snapshot tests or equivalent
```

---

## Step 4: Operator alerting

Build on Task 5 health signals with actual operator notifications where configured.

Required behavior:

```text
- SaaS can notify operators on critical production incidents
- OSS can surface clear owner-facing alerts for degraded local state
- alert routing and suppression rules are documented
- repeated identical alerts are deduplicated
```

---

## Step 5: OSS public release packaging and beta artifacts

Phase 5 must turn the OSS app into a releasable beta artifact.

Required deliverables:

```text
- tagged Docker image / release artifact process
- pinned compose/example env artifacts
- upgrade notes and rollback notes
- release checksum/signature strategy documented
- beta release checklist references packaging verification
```

For SaaS, ensure release process artifacts exist for beta deploys even if there is no public binary artifact.

---

## Step 6: Tests and CI/release wiring

Required tests/docs:

```text
- deployment-readiness checks validate required production env assumptions
- email template tests cover required template set
- release workflow includes build/test/package steps
- nightly or release-gate workflow runs real OSS<->SaaS integration path
```

---

## Step 7: Commit

```bash
git add railway.toml docs/deployment.md docs/operations.md docs/release-checklist.md docs/support-runbook.md web/src/pages/marketing/Contact.tsx web/src/App.tsx server/src/services/email-templates.ts server/src/services/alerts.ts Dockerfile .github/workflows/test.yml .github/workflows/release.yml server/tests/email-templates.test.ts server/tests/deployment-readiness.test.ts
git commit -m "feat: add deployment alerting email templates and release packaging"
```

---

# Phase 5 Completion Checklist

After completing all tasks, verify:

## Security

- [ ] Security checklist exists in both repos
- [ ] Threat model updated in both repos
- [ ] Key-management doc updated
- [ ] CSRF/session/reset/TOTP tests pass
- [ ] OSS TOTP recovery codes implemented and tested
- [ ] OSS password change implemented and tested
- [ ] sensitive auth and claim rate-limiting/throttling is implemented
- [ ] Sensitive DB-field encryption tests pass
- [ ] Audit redaction tests pass
- [ ] Log redaction tests pass
- [ ] Admin routes do not expose decrypted PII

## Release reliability

- [ ] Release-run transition guards implemented
- [ ] One-active-release-run rule enforced
- [ ] Worker restart recovery tested
- [ ] Idempotency keys or equivalent dedupe implemented
- [ ] Duplicate worker ticks do not duplicate notifications, uploads, or escalations

## Notifications

- [ ] Delivery-state table implemented
- [ ] Retry/backoff implemented
- [ ] Permanent failure handling implemented
- [ ] Payload minimization tests pass
- [ ] SaaS Postmark event handling implemented or explicitly deferred with doc note
- [ ] production-safe email templates implemented and tested

## Data lifecycle

- [x] OSS encrypted export implemented
- [x] OSS restore preview implemented
- [x] SaaS account export implemented
- [x] SaaS account deletion implemented or explicitly documented with beta constraints
- [x] Export does not leak plaintext sensitive data outside encrypted payload

## Observability

- [ ] Public health endpoint is minimal
- [ ] Authenticated detailed health endpoint exists
- [ ] Worker heartbeat persisted
- [ ] Structured redacted logs implemented
- [ ] SaaS admin operational dashboard shows non-sensitive health/metrics
- [ ] operational alerting exists for beta-critical failures

## SaaS operations

- [ ] Billing lifecycle edge cases handled
- [ ] Webhook replay is idempotent
- [ ] Admin support view excludes decrypted PII
- [ ] Support runbook exists
- [ ] public support/contact flow exists
- [ ] real production deploy/DNS runbook exists

## Legal/trust

- [ ] Terms page exists
- [ ] Privacy page exists
- [ ] Security page exists
- [ ] AUP page exists
- [ ] Data deletion page exists
- [ ] Disclaimers page exists
- [ ] Required acknowledgements stored

## Testing/docs

- [ ] OSS Relay auth-code linking implemented
- [ ] provider coverage docs/tests exist for supported OSS provider classes
- [ ] accessibility smoke coverage exists for critical flows
- [ ] docs/accessibility.md exists
- [ ] OSS public release packaging is documented and wired
- [ ] OSS E2E matrix passes
- [ ] SaaS E2E matrix passes
- [ ] real OSS<->SaaS integration coverage passes on nightly or release gate
- [ ] PR-path Relay E2E or mocked integration tests pass
- [ ] CI runs unit/build/E2E checks
- [ ] Known limitations doc exists
- [ ] Release checklist exists
- [ ] DeadDrop architecture doc exists
- [ ] DeadDrop API preview doc exists

---

# Next Phase

After Phase 5, proceed to:

```text
Phase 6: Product Polish, Helper Pack MVP, and Beta Launch Preparation
```

Phase 6 should focus on:

```text
- UI/UX polish across OSS and SaaS
- advanced email-template polish, localization, and lifecycle expansion
- onboarding refinement
- Helper Pack MVP
- executor guidance content model
- marketing site refinement
- beta invitation workflow
- feedback capture
- in-app guidance
- support workflows
- release notes/changelog
```

Do not begin public DeadDrop API implementation until the core product, Relay, Hosted, and beta reliability baseline are stable.
