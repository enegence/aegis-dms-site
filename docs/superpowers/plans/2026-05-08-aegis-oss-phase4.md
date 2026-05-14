# Aegis OSS — Phase 4: Setup Wizard, Settings, Deployment Polish, E2E, Docs

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the open-source Aegis Core alpha by turning the working Phase 1–3 engine into a self-hostable product: first-run setup wizard, interactive `setup.sh`, complete settings pages, deployment mode selector, TOTP setup, production Docker/self-hosting polish, E2E tests, README, and operator documentation — all with tests.

**Architecture:** Continue from Phase 3. The repo is a monorepo with `server/` (Fastify + Drizzle + SQLite), `web/` (React + Vite + Tailwind), `packages/shared/`, and `packages/contracts/`. Phase 4 does not rewrite core switch/packet/cascade logic. It makes the app installable, configurable, testable end-to-end, and understandable for self-hosters. The local app remains the authority for OSS release execution. Relay UI remains limited to configuration and connection handoff; full hosted/relay SaaS behavior lives in `aegis-dms-site/`.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, better-sqlite3, React 18, Vite, Tailwind CSS, Vitest, Playwright, Node crypto AES-256-GCM, Docker, Bash, `packages/contracts`.

**Parent plan:** `2026-05-06-aegis-master-plan.md`

**Target repo:** `aegis/`

> **Note on phase labels:** Phase labels are sequencing guidance, not fixed delivery estimates. Optimize for correctness, security, and coherent architecture over calendar targets.

---

## Pre-requisites

Before starting, the engineer needs:

- Phase 1 completed and passing.
- Phase 2 completed using `2026-05-08-aegis-oss-phase2.md`.
- Phase 3 completed using `2026-05-08-aegis-oss-phase3.md`.
- Owner setup/login/session/CSRF flow working.
- Estate item and contact CRUD working with encrypted sensitive fields.
- Switch CRUD/actions/readiness gates/check-in working.
- Notification providers for SMTP and Telegram working.
- Worker polling loop working.
- Packet builder, packet encryption, S3-compatible Dead Drop sync, release runs, contact cascade, claim portal, escalation, Release page, and audit display working.
- SQLite schema contains `owner`, `sessions`, `estate_items`, `contacts`, `switches`, `packets`, `contact_claims`, `release_runs`, `audit_events`, settings/app-settings table, and optional `local_acknowledgements`.
- All owner-authenticated state-changing routes require auth + CSRF.
- Public claim routes are token/hash based, rate-limited, and do not expose sensitive failures.

---

## Phase 4 Scope Boundary

### In Scope

- First-run setup wizard polish.
- Setup completion state and setup route guards.
- Interactive `setup.sh` for local/Docker deployments.
- Complete settings APIs and UI for owner profile, notifications, storage, Relay, security, deployment mode, packet retention, and danger-zone actions.
- Deployment mode selector and mode-specific warnings/acknowledgements.
- TOTP setup, verification, disable flow, recovery guidance, and tests.
- Environment validation and production startup hardening.
- Docker image polish and persistent volume checks.
- Backup/export/import guidance for self-hosters.
- E2E tests covering setup → data entry → switch arming → packet sync → claim simulation.
- README and docs for self-hosting, storage, notifications, threat model, key management, release modes, backups, troubleshooting, and upgrade notes.
- Final alpha smoke checklist.

### Explicitly Out of Scope

- Native mobile apps.
- Public DeadDrop API partner portal.
- Full Relay authorization-code implementation if not already available in SaaS; OSS should only implement the client-side hooks/UI handoff where supported.
- Full SaaS-hosted release execution.
- Shamir Secret Sharing.
- Zero-knowledge claims.
- Formal third-party security audit.
- HA production orchestration.

### Security Non-Negotiables

- Do not weaken CSRF/session protections for setup convenience.
- Do not log plaintext PII, packet plaintext, claim tokens, release keys, storage credentials, or Relay API keys.
- Default secrets must fail in production.
- Setup must generate high-entropy secrets.
- Settings pages must never display full stored secrets after save.
- Test buttons may show success/failure but not secret values.
- Deployment mode copy must accurately describe limitations.
- Vault Mode must not imply guaranteed automated release.
- Relay Monitoring must not imply release execution without Relay Escrow.

---

## Task 1: Finalize Setup State, Guards, and First-Run Routing

**Goal:** Ensure a fresh install reliably lands on setup, completed installs route to login/dashboard, and API routes enforce setup/auth/CSRF consistently.

**Files:**

- Update: `server/src/auth/plugin.ts`
- Update: `server/src/routes/auth.ts`
- Update: `server/src/routes/settings.ts`
- Update: `server/src/index.ts`
- Update: `web/src/App.tsx`
- Update/Create: `web/src/hooks/useSetupStatus.ts`
- Update/Create: `web/src/pages/Setup.tsx`
- Test: `server/tests/setup-guards.test.ts`

- [x] **Step 1: Add setup status endpoint if missing**

Implement or confirm:

```text
GET /api/setup/status
```

Response:

```ts
interface SetupStatusResponse {
  setupComplete: boolean;
  ownerExists: boolean;
  appVersion: string;
}
```

Rules:

```text
- Public endpoint.
- Does not expose owner email/name.
- Returns only setup state.
```

- [x] **Step 2: Harden setup route behavior**

Confirm:

```text
POST /api/setup
```

Rules:

```text
- Allowed only when setupComplete=false or no owner exists.
- Creates exactly one owner.
- Hashes password with Argon2id.
- Initializes required default settings.
- Writes audit event setup_completed.
- Sets secure session cookie after successful setup.
- Rejects repeat setup attempts once complete.
```

- [x] **Step 3: Add setup-aware route guards**

Server behavior:

```text
- If setup is incomplete, protected app APIs should return 428 Precondition Required or 403 with setup_required code.
- Setup and health endpoints remain public.
- Claim endpoints remain public but must not function until setup is complete.
```

Frontend behavior:

```text
- Unknown setup status: show loading shell.
- setupComplete=false: route to /setup.
- setupComplete=true and not authenticated: route to /login.
- setupComplete=true and authenticated: route to /dashboard.
```

- [x] **Step 4: Test setup guard behavior**

Create `server/tests/setup-guards.test.ts` covering:

```text
fresh DB returns setupComplete=false
setup creates owner and session
second setup attempt rejected
protected route rejected before setup
protected route requires auth after setup
claim route does not leak setup details
```

- [x] **Step 5: Run tests**

Run:

```bash
cd server && npm test -- setup-guards.test.ts
npm test
```

- [x] **Step 6: Commit**

```bash
git add server/src web/src server/tests
git commit -m "feat: finalize setup status and first-run route guards"
```

---

## Task 2: Build the First-Run Setup Wizard UI

**Goal:** Replace any placeholder setup page with a guided wizard that creates the owner account, explains deployment modes, and initializes safe defaults.

**Files:**

- Update: `web/src/pages/Setup.tsx`
- Create: `web/src/components/setup/SetupShell.tsx`
- Create: `web/src/components/setup/OwnerStep.tsx`
- Create: `web/src/components/setup/SecurityStep.tsx`
- Create: `web/src/components/setup/DeploymentModeStep.tsx`
- Create: `web/src/components/setup/ReviewStep.tsx`
- Update: `web/src/lib/api.ts`
- Test: `web/src/pages/Setup.test.tsx` or equivalent frontend test if available

- [x] **Step 1: Create wizard steps**

Wizard steps:

```text
1. Welcome / What Aegis does and does not do
2. Owner profile
3. Password / security baseline
4. Deployment mode selection
5. Mode limitation acknowledgement
6. Review and create owner
```

- [x] **Step 2: Owner profile form**

Fields:

```text
displayName
email
phone optional
timezone
```

Validation:

```text
displayName required
email valid
phone optional
timezone defaults to browser timezone if available
```

- [x] **Step 3: Password/security step**

Fields:

```text
password
confirmPassword
```

Rules:

```text
minimum length 12
must match
show password guidance
no password strength telemetry
```

- [x] **Step 4: Deployment mode step**

Available modes:

```text
Vault Mode
Dead Drop
Relay Monitoring
Relay Escrow
```

For Phase 4 OSS setup, default to:

```text
Vault Mode
```

Copy must explain:

```text
Vault Mode stores and organizes your legacy information locally. It does not guarantee automated release if this machine is offline, destroyed, inaccessible, or unable to notify your contacts.
```

- [x] **Step 5: Acknowledgement step**

Require checkbox:

```text
I understand Aegis is not a will, legal service, password manager, or guarantee of delivery. Release reliability depends on the deployment mode and configured services.
```

If Vault Mode selected, require:

```text
I understand Vault Mode is local planning/storage and may not perform automated release if this host is unavailable.
```

- [x] **Step 6: Submit setup**

Call:

```text
POST /api/setup
```

After success:

```text
- store auth state
- route to /dashboard
- show next-step checklist card
```

- [x] **Step 7: Frontend test**

Test:

```text
wizard renders
required fields block submit
deployment acknowledgement required
successful setup routes to dashboard
```

- [x] **Step 8: Commit**

```bash
git add web/src
git commit -m "feat: add guided first-run setup wizard"
```

---

## Task 3: Create Interactive `setup.sh`

**Goal:** Give self-hosters a one-command helper that creates `.env`, generates secrets, validates directories, and explains deployment next steps without hiding what is being configured.

**Files:**

- Create/Update: `setup.sh`
- Update: `.env.example`
- Update: `README.md`
- Test: manual shellcheck-style validation if available

- [x] **Step 1: Create script skeleton**

`setup.sh` should:

```bash
#!/usr/bin/env bash
set -euo pipefail
```

Behavior:

```text
- refuse to overwrite existing .env without confirmation
- create ./data directory
- generate AEGIS_SECRET_KEY
- generate AEGIS_FIELD_ENCRYPTION_KEY
- ask for app URL
- ask for port
- write .env
- print Docker Compose next steps
```

- [x] **Step 2: Generate high-entropy secrets**

Use available tools in priority order:

```text
openssl rand -hex 32
node -e crypto.randomBytes(32).toString('hex')
/dev/urandom fallback
```

`AEGIS_SECRET_KEY` should be at least 64 hex chars.

`AEGIS_FIELD_ENCRYPTION_KEY` should be 64 hex chars representing 32 bytes.

- [x] **Step 3: Prompt for optional providers**

Prompt sections:

```text
SMTP? y/N
Telegram? y/N
S3-compatible Dead Drop? y/N
Relay? y/N
```

If user skips, write blank config and explain it can be added in Settings later.

- [x] **Step 4: Add safety copy**

At completion, print:

```text
Your .env contains secrets. Keep it private and back it up securely.
Your SQLite database and data directory contain encrypted but sensitive application state.
Vault Mode alone does not guarantee automated release.
```

- [x] **Step 5: Validate script locally**

Run:

```bash
bash -n setup.sh
chmod +x setup.sh
./setup.sh
```

Use a temp directory or reset `.env` afterward.

- [x] **Step 6: Commit**

```bash
git add setup.sh .env.example README.md
git commit -m "feat: add interactive self-hosted setup script"
```

---

## Task 4: Implement Settings API Consolidation

**Goal:** Provide a stable server-side settings surface for notification providers, storage, Relay, deployment mode, packet retention, security, and danger-zone actions.

**Files:**

- Update: `server/src/routes/settings.ts`
- Update/Create: `server/src/services/settings.ts`
- Update: `server/src/services/field-encrypt.ts`
- Update: `server/src/services/notifications.ts`
- Update: `server/src/services/storage.ts`
- Test: `server/tests/settings.test.ts`

- [x] **Step 1: Define settings response shape**

Create safe settings response:

```ts
interface SettingsResponse {
  owner: {
    displayName: string;
    email: string;
    phone: string | null;
    timezone: string;
  };
  deployment: {
    mode: 'vault' | 'dead_drop' | 'relay_monitoring' | 'relay_escrow';
    acknowledgementVersion: string | null;
  };
  notifications: {
    smtpConfigured: boolean;
    telegramConfigured: boolean;
    defaultChannels: string[];
  };
  storage: {
    s3Configured: boolean;
    bucket: string | null;
    prefix: string | null;
    lastVerifiedAt: string | null;
  };
  relay: {
    enabled: boolean;
    relayUrl: string | null;
    apiKeyConfigured: boolean;
    lastHeartbeatAt: string | null;
  };
  security: {
    totpEnabled: boolean;
    sessionExpiresAt: string | null;
  };
  packets: {
    retentionDays: number | null;
  };
}
```

Never return full SMTP passwords, S3 secrets, Telegram token, Relay API key, or field encryption keys.

- [x] **Step 2: Add settings update endpoints**

Implement:

```text
GET /api/settings
PUT /api/settings/owner
PUT /api/settings/deployment
PUT /api/settings/notifications/smtp
PUT /api/settings/notifications/telegram
POST /api/settings/notifications/test
PUT /api/settings/storage/s3
POST /api/settings/storage/test
PUT /api/settings/relay
POST /api/settings/relay/test
PUT /api/settings/packets
```

All state-changing routes require auth + CSRF.

- [x] **Step 3: Encrypt provider secrets**

Encrypt at rest:

```text
SMTP password
Telegram bot token
S3 access key id
S3 secret access key
Relay API key
```

- [x] **Step 4: Add test endpoints behavior**

Test endpoints should return:

```ts
{
  ok: boolean;
  message: string;
  checkedAt: string;
}
```

Do not echo secret values.

- [x] **Step 5: Add tests**

Test:

```text
GET settings redacts secrets
PUT SMTP encrypts password
PUT S3 encrypts credentials
test endpoint does not expose credentials
missing CSRF rejected
unauthenticated rejected
```

- [x] **Step 6: Commit**

```bash
git add server/src/routes/settings.ts server/src/services server/tests/settings.test.ts
git commit -m "feat: consolidate secure settings api"
```

---

## Task 5: Build Settings UI

**Goal:** Create usable settings pages for owner profile, deployment mode, notification providers, storage, Relay, packets, and security.

**Files:**

- Update: `web/src/pages/Settings.tsx`
- Create: `web/src/components/settings/OwnerSettings.tsx`
- Create: `web/src/components/settings/DeploymentSettings.tsx`
- Create: `web/src/components/settings/NotificationSettings.tsx`
- Create: `web/src/components/settings/StorageSettings.tsx`
- Create: `web/src/components/settings/RelaySettings.tsx`
- Create: `web/src/components/settings/SecuritySettings.tsx`
- Create: `web/src/components/settings/PacketSettings.tsx`
- Create: `web/src/components/settings/DangerZone.tsx`
- Update: `web/src/lib/api.ts`

- [x] **Step 1: Build tabbed settings layout**

Tabs:

```text
Profile
Deployment
Notifications
Storage
Relay
Security
Packets
Danger Zone
```

- [x] **Step 2: Profile settings**

Allow update:

```text
displayName
email
phone
timezone
```

- [x] **Step 3: Deployment settings**

Show cards for:

```text
Vault Mode
Dead Drop
Relay Monitoring
Relay Escrow
```

Each card should show:

```text
what it does
what can fail
required readiness checks
whether current configuration is ready
```

Mode changes require acknowledgement.

- [x] **Step 4: Notification settings**

Support:

```text
SMTP host/port/user/password/from
Telegram bot token/chat ID
Test notification button
```

Mask saved secrets.

- [x] **Step 5: Storage settings**

Support:

```text
S3 endpoint
region
bucket
prefix
access key id
secret access key
force path style
Test storage button
```

Show:

```text
last verified at
configured/not configured
Dead Drop readiness impact
```

- [x] **Step 6: Relay settings**

Support current alpha behavior:

```text
Relay URL
Relay API key configured flag
manual API key entry if available
Disconnect Relay
Test heartbeat
```

If authorization-code linking is not implemented yet, show disabled card:

```text
Guided Relay connection will be available when paired with Aegis DMS Site Relay linking.
```

- [x] **Step 7: Security settings**

Include:

```text
TOTP setup/disable status
active session note
password change placeholder if not implemented
```

- [x] **Step 8: Packet settings**

Include:

```text
packet retention days
last packet generated
last packet uploaded
manual packet sync button if Phase 3 supports it
```

- [x] **Step 9: Danger zone**

Include guarded actions:

```text
export backup
clear provider credentials
delete local packets
factory reset placeholder
```

Factory reset may be documented but disabled unless implemented safely.

- [x] **Step 10: Commit**

```bash
git add web/src/pages/Settings.tsx web/src/components/settings web/src/lib/api.ts
git commit -m "feat: add complete self-hosted settings ui"
```

---

## Task 6: Implement TOTP Setup and Disable Flow

**Goal:** Make optional TOTP usable and tested from the UI.

**Files:**

- Update: `server/src/auth/totp.ts`
- Update/Create: `server/src/routes/security.ts`
- Update: `server/src/index.ts`
- Update: `web/src/components/settings/SecuritySettings.tsx`
- Test: `server/tests/totp.test.ts`

- [x] **Step 1: Add security routes**

Implement:

```text
POST /api/security/totp/start
POST /api/security/totp/confirm
POST /api/security/totp/disable
```

Rules:

```text
- Auth + CSRF required.
- start returns otpauth URL and QR-compatible secret display only during setup.
- confirm requires valid current TOTP code.
- disable requires password confirmation and current TOTP code if enabled.
- TOTP secret encrypted at rest.
```

- [x] **Step 2: Update login flow if needed**

If TOTP is enabled:

```text
POST /api/login returns requiresTotp=true and temporary login challenge
POST /api/login/totp verifies code and creates session
```

If Phase 1/2 already implemented this, verify tests and UI.

- [x] **Step 3: Build UI flow**

Security settings should show:

```text
TOTP disabled → Start setup
TOTP setup started → show QR/secret + code input
TOTP enabled → Disable flow
```

- [x] **Step 4: Add tests**

Test:

```text
start generates encrypted pending secret
confirm enables TOTP
invalid code rejected
enabled user requires TOTP at login
disable requires valid proof
missing CSRF rejected
```

- [x] **Step 5: Commit**

```bash
git add server/src/auth/totp.ts server/src/routes/security.ts server/src/index.ts web/src/components/settings/SecuritySettings.tsx server/tests/totp.test.ts
git commit -m "feat: add totp setup and security settings flow"
```

---

## Task 7: Add Backup, Export, and Restore Guidance

**Goal:** Give self-hosters a clear way to back up and restore app state without building a risky partial export feature prematurely.

**Files:**

- Create/Update: `docs/backups.md`
- Update: `README.md`
- Update: `web/src/components/settings/DangerZone.tsx`
- Optional Create: `server/src/routes/backup.ts`
- Optional Test: `server/tests/backup.test.ts`

- [x] **Step 1: Document backup scope**

Back up:

```text
.env
data/aegis.db
data/packets/ if local packet files exist
Docker Compose file if customized
```

Warn:

```text
.env contains encryption secrets.
Database alone may not be recoverable without .env.
S3 packets may not be useful without key material and metadata.
```

- [x] **Step 2: Add backup checklist UI**

In Danger Zone or Settings:

```text
What to back up
Last packet sync status
Link to docs/backups.md
```

- [x] **Step 3: Optional backup archive endpoint**

Only implement if safe:

```text
POST /api/backup/export
```

Requirements:

```text
- Auth + CSRF + password confirmation.
- Exports SQLite DB and app metadata.
- Does not include .env automatically unless explicitly requested and warned.
- Streams archive to owner only.
```

If not implemented, document manual backup commands instead.

- [x] **Step 4: Commit**

```bash
git add docs/backups.md README.md web/src/components/settings/DangerZone.tsx
git commit -m "docs: add self-hosted backup and restore guidance"
```

---

## Task 8: Harden Docker and Runtime Validation

**Goal:** Make the Docker deployment predictable, persistent, and safer for self-hosters.

**Files:**

- Update: `Dockerfile`
- Update: `docker-compose.yml`
- Update: `.dockerignore`
- Update: `server/src/config.ts`
- Update: `server/src/index.ts`
- Test: manual Docker build/run

- [x] **Step 1: Validate production config**

At startup, fail in production if:

```text
AEGIS_SECRET_KEY missing/default/too short
AEGIS_FIELD_ENCRYPTION_KEY missing/default/not 64 hex chars
AEGIS_DB_PATH not writable
configured data directory missing and cannot be created
configured provider secrets malformed
```

- [x] **Step 2: Ensure persistent volumes**

`docker-compose.yml` should include persistent mount:

```yaml
volumes:
  - ./data:/app/data
```

- [x] **Step 3: Add healthcheck**

Add Docker healthcheck:

```yaml
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://localhost:8000/health"]
  interval: 30s
  timeout: 5s
  retries: 3
```

Use `curl` or `wget` depending on image contents.

- [x] **Step 4: Build and run locally**

Run:

```bash
docker compose build
docker compose up -d
docker compose logs -f
curl http://localhost:8000/health
```

- [x] **Step 5: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore server/src/config.ts server/src/index.ts
git commit -m "chore: harden docker runtime and config validation"
```

---

## Task 9: Add E2E Test Harness

**Goal:** Add browser-level regression tests for the critical owner and claim flows.

**Files:**

- Update: `package.json`
- Update: `web/package.json`
- Create: `playwright.config.ts`
- Create: `tests/e2e/setup.spec.ts`
- Create: `tests/e2e/core-flow.spec.ts`
- Create: `tests/e2e/claim-flow.spec.ts`
- Create: `tests/e2e/settings.spec.ts`
- Create: `tests/e2e/helpers.ts`

- [x] **Step 1: Add Playwright dependencies and scripts**

Root scripts:

```json
{
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

- [x] **Step 2: Configure Playwright**

Use local dev server:

```text
npm run build
npm run start or test server command
```

Use isolated test DB path:

```text
AEGIS_DB_PATH=./data/e2e-aegis.db
NODE_ENV=test
```

- [x] **Step 3: Setup wizard E2E**

Test:

```text
fresh install routes to setup
owner can complete setup
owner lands on dashboard
login works after logout
```

- [x] **Step 4: Core app E2E**

Test:

```text
create estate item
create contact
create switch
readiness blocks arm until requirements met
configure minimal readiness or use test mode
arm switch
check-in updates dashboard
```

- [x] **Step 5: Claim flow E2E**

Use test hooks or seeded data to simulate triggered release.

Test:

```text
claim URL opens
invalid token generic failure
valid claim can open
verification step works
accept step works
packet download/key view gated by claim state
acknowledge completes claim
```

- [x] **Step 6: Settings E2E**

Test:

```text
settings page loads
secret fields are masked
test buttons do not reveal secrets
TOTP setup screen renders
backup docs link visible
```

- [x] **Step 7: Commit**

```bash
git add package.json web/package.json playwright.config.ts tests/e2e
git commit -m "test: add e2e coverage for setup settings and claim flows"
```

---

## Task 10: Write Self-Hosting Documentation

**Goal:** Make the OSS repo usable by someone other than the implementer.

**Files:**

- Update: `README.md`
- Create: `docs/self-hosting.md`
- Create: `docs/storage-setup.md`
- Create: `docs/notification-setup.md`
- Create: `docs/release-modes.md`
- Create: `docs/key-management.md`
- Create: `docs/threat-model.md`
- Create: `docs/backups.md`
- Create: `docs/troubleshooting.md`
- Create: `docs/upgrading.md`

- [x] **Step 1: README structure**

README should include:

```text
What Aegis is
What Aegis is not
Deployment modes
Quick start
Docker Compose install
First-run setup
Config reference
Backup warning
Security model summary
Docs links
License
```

- [x] **Step 2: Self-hosting guide**

Include:

```text
requirements
Docker Compose install
Unraid notes
TrueNAS/VPS notes
reverse proxy notes
Tailscale/private access notes
public claim URL warning
updating containers
backup/restore basics
```

- [x] **Step 3: Storage setup guide**

Include examples for:

```text
Cloudflare R2
AWS S3
MinIO
Backblaze B2 S3-compatible
```

- [x] **Step 4: Notification guide**

Include:

```text
SMTP setup
Gmail/App Password warning if applicable
Postmark/Mailgun style providers
Telegram bot setup
notification test flow
failure modes
```

- [x] **Step 5: Release modes doc**

Document:

```text
Vault Mode
Dead Drop
Relay Monitoring
Relay Escrow
Hosted
```

For OSS, Hosted should be described as SaaS product, not local mode.

- [x] **Step 6: Key management doc**

Document:

```text
field encryption
packet encryption
env secrets
local key release
Dead Drop limitations
Relay Monitoring limitations
Relay Escrow trust model
no Shamir in alpha
no zero-knowledge claim in alpha
```

- [x] **Step 7: Threat model doc**

Document:

```text
stolen device
compromised host
lost .env
failed notifications
malicious contact
false trigger
storage provider failure
host unavailable at trigger time
```

- [x] **Step 8: Commit**

```bash
git add README.md docs
git commit -m "docs: add self-hosting security and operations guides"
```

---

## Task 11: Add Alpha Readiness Checklist

**Goal:** Provide a final checklist that prevents release of an obviously unsafe or nonfunctional alpha.

**Files:**

- Create: `docs/alpha-readiness.md`
- Update: `README.md`
- Optional Update: `web/src/pages/Dashboard.tsx`

- [x] **Step 1: Create readiness checklist doc**

Checklist:

```text
all unit tests pass
all E2E tests pass
Docker build succeeds
fresh install succeeds
setup wizard succeeds
estate/contact CRUD works
switch readiness gates work
notification test works
packet generation works
S3 test works if Dead Drop enabled
claim simulation works
backup docs written
release mode warnings visible
no default secrets in production
no plaintext PII in audit logs
```

- [x] **Step 2: Add UI alpha warning if appropriate**

Dashboard or footer copy:

```text
Aegis Core alpha: verify your deployment, backups, notifications, and packet sync before relying on this system.
```

- [x] **Step 3: Commit**

```bash
git add docs/alpha-readiness.md README.md web/src/pages/Dashboard.tsx
git commit -m "docs: add alpha readiness checklist"
```

---

## Task 12: Final Full Test and Release Candidate Pass

**Goal:** Run the full local quality gate and produce a clean Phase 4 completion state.

**Files:**

- Update: any failing files found during final pass
- Create: `docs/phase4-completion-notes.md`

- [x] **Step 1: Run full server tests**

```bash
npm test
```

or:

```bash
npm run test --workspace=server
```

- [x] **Step 2: Run frontend build**

```bash
npm run build --workspace=web
```

- [x] **Step 3: Run full app build**

```bash
npm run build
```

- [x] **Step 4: Run Docker build**

```bash
docker compose build
```

- [x] **Step 5: Run E2E tests**

```bash
npm run test:e2e
```

- [x] **Step 6: Manual smoke test**

Test manually:

```text
fresh setup
login/logout
estate item CRUD
contact CRUD
settings save/test
switch create/arm/check-in
packet generate/sync
claim simulation
backup docs visible
```

- [x] **Step 7: Completion notes**

Create `docs/phase4-completion-notes.md` with:

```text
implemented items
test results
known limitations
manual smoke results
recommended next phase
```

- [x] **Step 8: Final commit**

```bash
git add -A
git commit -m "chore: complete phase 4 alpha polish for aegis core"
```

---

## Phase 4 Completion Criteria

Phase 4 is complete when:

```text
- Fresh install routes to setup wizard.
- Setup wizard creates owner and secure defaults.
- setup.sh generates a usable .env with strong secrets.
- Settings UI supports profile, deployment, notifications, storage, Relay, security, packets, and backup guidance.
- TOTP setup/disable works if enabled.
- Deployment modes have accurate warnings.
- Docker Compose install works with persistent data.
- E2E tests cover setup, settings, core app, and claim flow.
- README and docs are usable by a self-hoster.
- Full tests/build/Docker/E2E pass.
- Phase 4 completion notes exist.
```

---

## Recommended Next Phase

After Phase 4, the next logical OSS work is **integration hardening and public alpha preparation**:

```text
- Relay authorization-code connection flow with SaaS.
- More provider integrations.
- Better backup/export tooling.
- Accessibility polish.
- More failure-mode tests.
- Security review.
- Public release packaging.
```
