# Aegis DMS Site — Phase 4: Onboarding, Relay UI, Billing Portal, Deployment, E2E

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the commercial Aegis DMS Site alpha by turning the Phase 1–3 SaaS foundation into a deployable product: onboarding flow, Relay connection UI, billing portal management, production/Railway deployment configuration, hosted account settings, operational docs, and end-to-end tests for hosted and relay workflows — all with tests.

**Architecture:** Continue from Phase 3. The repo is a monorepo with `server/` (Fastify + Drizzle + PostgreSQL), `web/` (React + Vite + Tailwind), `packages/shared/`, and `packages/contracts/`. Phase 4 does not rewrite auth/billing/packets/cascade. It connects the user-facing SaaS surfaces: Aegis Hosted onboarding, Aegis Relay connection management, billing management, admin/ops polish, Railway deployment, and E2E validation. DeadDrop API remains a future platform layer; do not expose a public partner API in this phase unless already explicitly implemented.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, PostgreSQL, React 18, Vite, Tailwind CSS, Vitest, Playwright, Stripe, Postmark, Telegram Bot API, AWS SDK v3/R2-compatible storage, Docker/Railway, `packages/contracts`.

**Parent plan:** `2026-05-06-aegis-master-plan.md`

**Target repo:** `aegis-dms-site/`

> **Note on phase labels:** Phase labels are sequencing guidance, not fixed delivery estimates. Optimize for correctness, security, and coherent architecture over calendar targets.

---

## Pre-requisites

Before starting, the engineer needs:

- SaaS Phase 1 completed and merged.
- SaaS Phase 2 completed using `2026-05-08-aegis-dms-site-phase2.md`.
- SaaS Phase 3 completed using `2026-05-08-aegis-dms-site-phase3.md`.
- Auth/register/login/email verification/password reset/session/CSRF working.
- Stripe checkout, webhook, subscription lifecycle, pricing API, and customer portal service working or scaffolded.
- Postmark service working.
- Relay connection management, API-key hashing/rotation/revocation working.
- Relay heartbeat API and Relay monitor working.
- Hosted estate/contact/switch CRUD working with encrypted sensitive fields.
- Hosted packet generation, managed storage, hosted notification dispatch, hosted cascade, hosted claim portal, Relay-assisted cascade, Relay Escrow acknowledgement, and admin basics working.
- `packages/contracts` compatible with OSS contracts.
- PostgreSQL schema contains `users`, `sessions`, `subscriptions`, `relay_connections`, `estate_items`, `contacts`, `switches`, `packets`, `contact_claims`, `release_runs`, `trust_acknowledgements`, `audit_events`, and any admin/notification event tables from Phase 3.
- Browser state-changing routes require auth + CSRF.
- API-key routes such as Relay heartbeat use hashed API-key auth and strict payload validation.

---

## Phase 4 Scope Boundary

### In Scope

- Authenticated onboarding flow for new users.
- Plan-aware routing for Relay vs Hosted users.
- Hosted first-run checklist.
- Relay connection UI for self-hosted users.
- Authorization-code style Relay linking endpoints/UI if not already completed.
- Relay API key rotation/revocation UI.
- Billing management page with Stripe customer portal link.
- Subscription status UX and gating.
- Account settings and security settings polish.
- Railway deployment config and production environment validation.
- Production-safe CORS/cookies/CSRF/session settings.
- Operational docs for deploying, configuring Stripe/Postmark/R2/Telegram, and running migrations.
- E2E tests for marketing → register → subscribe → onboarding → hosted app, and Relay connection/heartbeat flow.
- Admin dashboard polish for alpha operations.
- Final alpha readiness checklist and completion notes.

### Explicitly Out of Scope

- Public DeadDrop partner API/developer portal.
- SDK publishing.
- Usage-based partner billing.
- Formal legal page finalization beyond placeholders/links.
- Advanced organization/team accounts.
- Shamir Secret Sharing.
- Zero-knowledge claims.
- Native mobile apps.
- Full HA/multi-region deployment.

### Security Non-Negotiables

- No API keys in URL query strings.
- SaaS stores only API key hashes.
- Relay link codes must be short-lived and single-use.
- CSRF remains required for browser state-changing routes.
- Webhook routes validate signatures and do not use browser CSRF.
- Stripe portal/billing actions require authenticated user and ownership checks.
- Production cookies must be Secure, HttpOnly, and SameSite Lax or Strict.
- CORS must be an explicit allowlist in production.
- Do not log plaintext PII, packet plaintext, claim tokens, release keys, storage credentials, Stripe secrets, Postmark tokens, Telegram tokens, or API keys.
- Relay Escrow and Hosted trust acknowledgements remain versioned and auditable.

---

## Task 1: Finalize Onboarding State and Plan-Aware Routing

**Goal:** Guide users after registration/payment into the right product path: Hosted setup, Relay setup, or billing-required state.

**Files:**

- Update: `server/src/db/schema.ts`
- Update/Create: `server/drizzle/*.sql`
- Update/Create: `server/src/routes/onboarding.ts`
- Update: `server/src/routes/auth.ts`
- Update: `server/src/routes/billing.ts`
- Update: `server/src/index.ts`
- Update: `web/src/App.tsx`
- Create: `web/src/pages/app/Onboarding.tsx`
- Create: `web/src/components/onboarding/OnboardingShell.tsx`
- Test: `server/tests/onboarding.test.ts`

- [ ] **Step 1: Add onboarding state if missing**

Add or confirm user/account fields:

```text
onboardingCompletedAt nullable
preferredProduct nullable // relay | hosted | undecided
lastOnboardingStep nullable
```

Alternative: create `user_onboarding` table:

```ts
userId
preferredProduct
currentStep
completedAt
metadata redacted JSON
createdAt
updatedAt
```

- [ ] **Step 2: Add onboarding API**

Implement:

```text
GET /api/onboarding
PUT /api/onboarding/preferred-product
POST /api/onboarding/complete-step
POST /api/onboarding/complete
```

Rules:

```text
- Auth + CSRF required for state changes.
- Response includes subscription state and recommended next route.
- Does not expose sensitive payment/provider secrets.
```

- [ ] **Step 3: Plan-aware route resolution**

Route logic:

```text
No active subscription:
  show billing/pricing CTA.

Active relay subscription:
  route to Relay setup/checklist.

Active hosted subscription:
  route to Hosted setup/checklist.

Both active or admin/test account:
  let user choose product surface.
```

- [ ] **Step 4: Build onboarding UI**

Onboarding paths:

```text
Aegis Hosted:
  1. Explain Hosted trust model
  2. Trust acknowledgement
  3. Create first contact
  4. Create first estate item/instruction
  5. Create first switch draft
  6. Review readiness

Aegis Relay:
  1. Explain Relay Monitoring vs Relay Escrow
  2. Connect self-hosted app
  3. Send test heartbeat
  4. Optional Relay Escrow acknowledgement
  5. Review relay status
```

- [ ] **Step 5: Tests**

Test:

```text
new user receives onboarding state
preferred product can be set
unauthenticated rejected
missing CSRF rejected
inactive subscription gets billing CTA
relay user gets relay next step
hosted user gets hosted next step
```

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/onboarding.ts server/src/db server/drizzle web/src/App.tsx web/src/pages/app/Onboarding.tsx web/src/components/onboarding server/tests/onboarding.test.ts
git commit -m "feat: add plan-aware onboarding flow"
```

---

## Task 2: Build Hosted Onboarding Checklist

**Goal:** Give fully hosted users a clear path from empty account to a ready draft switch.

**Files:**

- Create: `web/src/components/onboarding/HostedOnboarding.tsx`
- Create: `web/src/components/onboarding/TrustModelCard.tsx`
- Update: `web/src/pages/app/Dashboard.tsx`
- Update: `web/src/lib/api.ts`
- Test: frontend smoke test if available

- [ ] **Step 1: Create checklist model**

Checklist items:

```text
Accept Hosted trust model
Add at least one contact
Add at least one estate item/instruction
Create a switch draft
Review readiness checks
Test notification path if available
```

- [ ] **Step 2: Trust acknowledgement card**

Required copy:

```text
Aegis Hosted is a managed service. Aegis SaaS stores and processes your encrypted legacy packet and executes release workflows under your configured policy. This is different from self-hosting.
```

Require versioned acknowledgement using existing `trust_acknowledgements` table.

- [ ] **Step 3: Deep links**

Checklist should link to:

```text
/app/contacts/new
/app/estate/new
/app/switches/new
/app/settings/security
/app/billing
```

- [ ] **Step 4: Dashboard integration**

If onboarding incomplete, dashboard should show:

```text
Finish setting up Aegis Hosted
```

After completion, show normal hosted dashboard.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/onboarding web/src/pages/app/Dashboard.tsx web/src/lib/api.ts
git commit -m "feat: add hosted onboarding checklist"
```

---

## Task 3: Implement Relay Connection UI and Linking Flow

**Goal:** Let self-hosted users connect Aegis Core to Aegis Relay without exposing API keys in URLs.

**Files:**

- Update/Create: `server/src/routes/relay-link.ts`
- Update: `server/src/routes/relay.ts`
- Update: `server/src/services/relay.ts`
- Update: `server/src/db/schema.ts`
- Update/Create: `server/drizzle/*.sql`
- Create: `web/src/pages/app/Relay.tsx`
- Create: `web/src/components/relay/RelayConnectCard.tsx`
- Create: `web/src/components/relay/RelayConnectionList.tsx`
- Create: `web/src/components/relay/RelayHeartbeatStatus.tsx`
- Create: `web/src/components/relay/RelayEscrowCard.tsx`
- Test: `server/tests/relay-link.test.ts`

- [ ] **Step 1: Add relay link code table if missing**

Create table:

```ts
relay_link_codes
  id
  userId
  codeHash
  callbackUrl
  state
  nonce
  expiresAt
  usedAt
  createdAt
```

- [ ] **Step 2: Start link flow endpoint**

Implement:

```text
POST /api/relay/link/start
```

Input:

```ts
{
  callbackUrl: string;
  state: string;
  label?: string;
}
```

Rules:

```text
- Auth + CSRF required.
- User must have Relay subscription or admin/test entitlement.
- Validate callback URL against safe local/self-host rules.
- Generate short-lived single-use code.
- Store only code hash.
```

- [ ] **Step 3: Confirm link flow endpoint**

Implement server-to-server exchange endpoint:

```text
POST /api/relay/link/exchange
```

Input:

```ts
{
  code: string;
  state: string;
  instanceId?: string;
  instanceLabel?: string;
}
```

Response:

```ts
{
  relayEndpoint: string;
  apiKey: string;
  connectionId: string;
}
```

Rules:

```text
- Code expires in 5–10 minutes.
- Code is single-use.
- State must match.
- API key returned only once in response body.
- SaaS stores only API key hash.
- Write audit event.
```

- [ ] **Step 4: Add UI for manual/guided linking**

Relay page should show:

```text
active relay connections
last heartbeat
status
copyable SaaS connect URL / instructions
API key rotation/revocation actions
```

- [ ] **Step 5: Add connection management actions**

Implement UI/API:

```text
rotate API key
revoke connection
rename connection
view heartbeat history summary
```

Rotation behavior:

```text
- Creates new API key.
- Shows it once.
- Hashes server-side.
- Invalidates old key immediately or after optional grace if implemented.
```

- [ ] **Step 6: Tests**

Test:

```text
link code generated for subscribed user
unsubscribed user rejected
code hash stored, plaintext not stored
expired code rejected
used code rejected
state mismatch rejected
exchange returns API key only once
API key hash authenticates heartbeat
revoked key rejected
```

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/relay-link.ts server/src/routes/relay.ts server/src/services/relay.ts server/src/db server/drizzle web/src/pages/app/Relay.tsx web/src/components/relay server/tests/relay-link.test.ts
git commit -m "feat: add secure relay connection ui and link exchange"
```

---

## Task 4: Add Relay Escrow UX and Trust Enforcement

**Goal:** Make Relay Escrow explicit, opt-in, versioned, and visually distinct from Relay Monitoring.

**Files:**

- Update: `server/src/routes/relay.ts`
- Update: `server/src/routes/settings.ts`
- Update/Create: `server/src/services/trust-acknowledgements.ts`
- Update: `web/src/components/relay/RelayEscrowCard.tsx`
- Update: `web/src/components/onboarding/TrustModelCard.tsx`
- Test: `server/tests/relay-escrow-ack.test.ts`

- [ ] **Step 1: Define escrow status response**

Response:

```ts
interface RelayEscrowStatus {
  enabled: boolean;
  acknowledgementRequired: boolean;
  acknowledgementVersion: string;
  lastAcceptedAt: string | null;
  eligibleConnections: Array<{ id: string; label: string | null }>;
}
```

- [ ] **Step 2: Enforce acknowledgement before enabling escrow**

Endpoint:

```text
POST /api/relay/escrow/acknowledge
POST /api/relay/escrow/enable
POST /api/relay/escrow/disable
```

Rules:

```text
- Auth + CSRF required.
- Active Relay plan required.
- Acknowledgement version must match current server version.
- Write trust_acknowledgement row.
- Write audit event.
```

- [ ] **Step 3: Required copy**

Use:

```text
Relay Escrow increases release resilience by allowing Aegis SaaS to execute your configured release policy if your self-hosted server remains offline. This requires trusting Aegis SaaS with release authority or release material according to the selected configuration.
```

- [ ] **Step 4: Tests**

Test:

```text
enable escrow rejected without acknowledgement
acknowledgement creates versioned record
enable escrow succeeds after acknowledgement
stale acknowledgement version rejected
unsubscribed user rejected
```

- [ ] **Step 5: Commit**

```bash
git add server/src/routes server/src/services/trust-acknowledgements.ts web/src/components/relay web/src/components/onboarding server/tests/relay-escrow-ack.test.ts
git commit -m "feat: add relay escrow trust acknowledgement flow"
```

---

## Task 5: Build Billing Management Page

**Goal:** Let users see subscription status, current plan, pricing link, and open Stripe customer portal.

**Files:**

- Update: `server/src/routes/billing.ts`
- Update: `server/src/services/stripe.ts`
- Create: `web/src/pages/app/Billing.tsx`
- Create: `web/src/components/billing/PlanStatusCard.tsx`
- Create: `web/src/components/billing/BillingActions.tsx`
- Update: `web/src/App.tsx`
- Test: `server/tests/billing-portal.test.ts`

- [ ] **Step 1: Add billing summary endpoint**

Implement:

```text
GET /api/billing/summary
```

Response:

```ts
interface BillingSummary {
  customerId: string | null;
  subscriptions: Array<{
    id: string;
    plan: 'relay' | 'hosted';
    status: string;
    currentPeriodEnd: string | null;
    cancelledAt: string | null;
  }>;
  hasRelay: boolean;
  hasHosted: boolean;
  pricingUrl: string;
}
```

- [ ] **Step 2: Add customer portal endpoint**

Implement:

```text
POST /api/billing/portal
```

Rules:

```text
- Auth + CSRF required.
- User must own Stripe customer ID.
- Creates Stripe billing portal session.
- Return URL should be /app/billing.
```

- [ ] **Step 3: Build Billing UI**

Show:

```text
current plan(s)
subscription status
renewal/current period date
cancelled state if applicable
open billing portal button
pricing page link
```

- [ ] **Step 4: Subscription gating copy**

If no active plan:

```text
Choose Aegis Relay to connect a self-hosted instance, or Aegis Hosted for the fully managed app.
```

- [ ] **Step 5: Tests**

Test:

```text
billing summary requires auth
portal requires CSRF
portal session created for user customer
user cannot access another customer
no customer returns actionable error
```

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/billing.ts server/src/services/stripe.ts web/src/pages/app/Billing.tsx web/src/components/billing web/src/App.tsx server/tests/billing-portal.test.ts
git commit -m "feat: add billing management page and customer portal"
```

---

## Task 6: Account and Security Settings

**Goal:** Provide basic account settings, password change, security visibility, and session-safe update flows.

**Files:**

- Update/Create: `server/src/routes/settings.ts`
- Update/Create: `server/src/routes/security.ts`
- Create: `web/src/pages/app/Settings.tsx`
- Create: `web/src/components/settings/AccountSettings.tsx`
- Create: `web/src/components/settings/SecuritySettings.tsx`
- Create: `web/src/components/settings/NotificationPreferenceSettings.tsx`
- Test: `server/tests/account-settings.test.ts`

- [ ] **Step 1: Add account settings endpoints**

Implement:

```text
GET /api/settings/account
PUT /api/settings/account
POST /api/security/change-password
```

Rules:

```text
- Auth + CSRF required.
- Email change may require verification if implemented; otherwise mark as future.
- Password change requires current password.
- Write audit event for password change and profile update.
```

- [ ] **Step 2: Build settings UI**

Tabs:

```text
Account
Security
Notifications
Billing
Relay
Hosted
```

- [ ] **Step 3: Security page**

Show:

```text
email verification status
password change form
TOTP placeholder/status if not implemented
active session note
```

- [ ] **Step 4: Tests**

Test:

```text
profile update requires auth + CSRF
password change requires current password
wrong password rejected
password hash changes on success
sensitive fields not returned
```

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/settings.ts server/src/routes/security.ts web/src/pages/app/Settings.tsx web/src/components/settings server/tests/account-settings.test.ts
git commit -m "feat: add account and security settings"
```

---

## Task 7: Polish Admin Dashboard for Alpha Operations

**Goal:** Make the admin dashboard useful for early operations without exposing sensitive user data.

**Files:**

- Update: `server/src/routes/admin.ts`
- Update/Create: `server/src/services/admin-metrics.ts`
- Update: `web/src/pages/admin/AdminDashboard.tsx`
- Create: `web/src/components/admin/UserTable.tsx`
- Create: `web/src/components/admin/SubscriptionMetrics.tsx`
- Create: `web/src/components/admin/RelayMetrics.tsx`
- Create: `web/src/components/admin/SystemHealthPanel.tsx`
- Test: `server/tests/admin-dashboard.test.ts`

- [ ] **Step 1: Admin auth rule**

Confirm admin routes require:

```text
authenticated user
admin flag or configured admin email
CSRF for state-changing admin actions
```

If no admin role exists, use explicit env allowlist for alpha:

```text
AEGIS_ADMIN_EMAILS=eric@example.com,other@example.com
```

- [ ] **Step 2: Metrics endpoints**

Implement/read:

```text
GET /api/admin/metrics
GET /api/admin/users
GET /api/admin/relay-connections
GET /api/admin/subscriptions
GET /api/admin/system-health
```

- [ ] **Step 3: Redaction requirements**

Admin UI may show:

```text
user email
plan/status
created date
last login if tracked
relay status
subscription status
```

Admin UI must not show:

```text
estate item contents
contact details beyond user account email
packet plaintext
release keys
claim tokens
API keys
storage credentials
```

- [ ] **Step 4: Build UI panels**

Admin dashboard panels:

```text
Users
Subscriptions
Relay Connections
Hosted Release Runs Summary
System Health
Recent Redacted Audit Events
```

- [ ] **Step 5: Tests**

Test:

```text
non-admin rejected
admin can load metrics
sensitive data is not returned
pagination works for users
```

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/admin.ts server/src/services/admin-metrics.ts web/src/pages/admin web/src/components/admin server/tests/admin-dashboard.test.ts
git commit -m "feat: polish alpha admin dashboard"
```

---

## Task 8: Railway Deployment Configuration

**Goal:** Add production deployment configuration for Railway and harden runtime config for SaaS.

**Files:**

- Create/Update: `railway.toml`
- Update: `Dockerfile` if present
- Update/Create: `.dockerignore`
- Update: `server/src/config.ts`
- Update: `server/src/index.ts`
- Update: `README.md`
- Create: `docs/deployment.md`
- Test: local production build

- [ ] **Step 1: Add Railway config**

Create/update:

```toml
[build]
builder = "DOCKERFILE"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

Adjust to actual Railway deployment model if using Nixpacks instead of Dockerfile.

- [ ] **Step 2: Production config validation**

Fail production startup if missing/default:

```text
AEGIS_SECRET_KEY
AEGIS_FIELD_ENCRYPTION_KEY
AEGIS_BASE_URL
DATABASE_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
POSTMARK_API_TOKEN
POSTMARK_FROM_EMAIL
```

Allow optional empty:

```text
TELEGRAM_BOT_TOKEN
R2/S3 vars if hosted storage is disabled in current env
```

- [ ] **Step 3: Production CORS/cookies**

Ensure:

```text
CORS origin = AEGIS_BASE_URL or explicit allowlist
credentials true only for allowlisted origins
cookies Secure in production
cookies HttpOnly
SameSite=Lax or Strict
trust proxy configured if needed behind Railway
```

- [ ] **Step 4: Static serving**

Confirm server serves built Vite app in production:

```text
web/dist
SPA fallback
health route still available
API routes not swallowed by fallback
```

- [ ] **Step 5: Build locally**

Run:

```bash
npm run build
NODE_ENV=production npm run start --workspace=server
```

Use test env vars and local DB.

- [ ] **Step 6: Deployment docs**

`docs/deployment.md` should cover:

```text
Railway services
Postgres provisioning
required env vars
Stripe webhook setup
Postmark domain setup
R2/S3 setup
health checks
migration commands
rollback notes
```

- [ ] **Step 7: Commit**

```bash
git add railway.toml Dockerfile .dockerignore server/src/config.ts server/src/index.ts README.md docs/deployment.md
git commit -m "chore: add railway deployment configuration and production validation"
```

---

## Task 9: Add Production Operations Docs

**Goal:** Document the minimum operating procedures needed to run the SaaS alpha responsibly.

**Files:**

- Create: `docs/operations.md`
- Create: `docs/stripe.md`
- Create: `docs/postmark.md`
- Create: `docs/storage.md`
- Create: `docs/relay.md`
- Create: `docs/incident-response.md`
- Update: `README.md`

- [ ] **Step 1: Operations doc**

Include:

```text
service overview
required env vars
migration procedure
deploy procedure
log review
health check
backup assumptions
known limitations
```

- [ ] **Step 2: Stripe doc**

Include:

```text
products/prices
webhook endpoint
webhook events used
local webhook testing
customer portal setup
failure modes
```

- [ ] **Step 3: Postmark doc**

Include:

```text
server token setup
from email/domain setup
templates if used
bounce/failure handling
```

- [ ] **Step 4: Storage doc**

Include:

```text
R2/S3 bucket setup
object prefixing
permissions
retention expectations
delete behavior
```

- [ ] **Step 5: Relay doc**

Include:

```text
Relay Monitoring vs Relay Escrow
heartbeat interval expectations
offline detection
API key handling
linking flow
revocation
```

- [ ] **Step 6: Incident response doc**

Include:

```text
lost API key
compromised API key
Stripe webhook failure
Postmark failure
storage outage
false trigger report
claim abuse report
suspected data exposure
```

- [ ] **Step 7: Commit**

```bash
git add docs README.md
git commit -m "docs: add saas operations and provider setup guides"
```

---

## Task 10: Add SaaS E2E Test Harness

**Goal:** Add browser-level tests for marketing, registration, billing, onboarding, hosted setup, Relay setup, and claim/admin smoke flows.

**Files:**

- Update: `package.json`
- Update: `web/package.json`
- Create: `playwright.config.ts`
- Create: `tests/e2e/helpers.ts`
- Create: `tests/e2e/marketing-auth.spec.ts`
- Create: `tests/e2e/billing.spec.ts`
- Create: `tests/e2e/hosted-onboarding.spec.ts`
- Create: `tests/e2e/relay-connection.spec.ts`
- Create: `tests/e2e/claim-portal.spec.ts`
- Create: `tests/e2e/admin.spec.ts`

- [ ] **Step 1: Add Playwright scripts**

Root scripts:

```json
{
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

- [ ] **Step 2: Configure isolated test environment**

Use:

```text
NODE_ENV=test
DATABASE_URL=postgresql://aegis:aegis@localhost:5432/aegis_site_test
STRIPE test/mocked mode
POSTMARK test/mocked mode
```

If real Stripe/Postmark are not used in E2E, mock services at the server boundary.

- [ ] **Step 3: Marketing/auth E2E**

Test:

```text
landing page renders
pricing page renders
register page works
login/logout works
reset password request does not leak account existence
```

- [ ] **Step 4: Billing E2E**

Test with mocks:

```text
pricing cards show
checkout button calls checkout endpoint
billing page shows inactive state
mock active subscription unlocks onboarding path
portal button calls portal endpoint
```

- [ ] **Step 5: Hosted onboarding E2E**

Test:

```text
hosted user sees Hosted trust acknowledgement
adds contact
adds estate item
creates draft switch
readiness appears
```

- [ ] **Step 6: Relay connection E2E**

Test:

```text
relay user opens Relay page
start link flow creates code
exchange flow succeeds using test helper
heartbeat updates status
rotate/revoke actions work
```

- [ ] **Step 7: Claim portal E2E**

Use seeded release run.

Test:

```text
invalid token generic failure
valid claim opens
verification works
accept/download/key-view/acknowledge path works according to Phase 3 behavior
```

- [ ] **Step 8: Admin E2E**

Test:

```text
non-admin cannot access /admin
admin can access dashboard
metrics panels render
sensitive data not visible
```

- [ ] **Step 9: Commit**

```bash
git add package.json web/package.json playwright.config.ts tests/e2e
git commit -m "test: add saas e2e coverage for onboarding relay billing and admin"
```

---

## Task 11: Final Marketing and App Shell Polish

**Goal:** Ensure the public and authenticated surfaces clearly explain the product boundaries without overpromising.

**Files:**

- Update: `web/src/pages/marketing/Landing.tsx`
- Update: `web/src/pages/marketing/Pricing.tsx`
- Update: `web/src/pages/marketing/Docs.tsx`
- Update: `web/src/components/layout/AppShell.tsx`
- Update: `web/src/components/layout/Nav.tsx`

- [ ] **Step 1: Public positioning copy**

Use consistent positioning:

```text
Aegis is legacy-release infrastructure for self-hosters, families, and future platform integrations.
```

Product cards:

```text
Aegis Hosted
Aegis Relay
Aegis Core
DeadDrop API (future)
```

- [ ] **Step 2: Avoid overclaims**

Do not claim:

```text
guaranteed delivery
legal replacement
zero knowledge
bank-level anything
Shamir protection
```

Unless actually implemented and validated.

- [ ] **Step 3: App navigation**

Authenticated nav should include:

```text
Dashboard
Hosted
Relay
Claims/Release Runs
Billing
Settings
Admin if admin
```

Adjust labels to match actual pages.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/marketing web/src/components/layout
git commit -m "chore: polish product positioning and app navigation"
```

---

## Task 12: Final Full Test and Deployment Candidate Pass

**Goal:** Run the full quality gate and leave the SaaS repo in a deployable alpha state.

**Files:**

- Update: any failing files found during final pass
- Create: `docs/phase4-completion-notes.md`
- Create: `docs/alpha-readiness.md`

- [ ] **Step 1: Run full server tests**

```bash
npm run test --workspace=server
```

- [ ] **Step 2: Run contract tests**

```bash
npm run test --workspace=packages/contracts
```

or the actual workspace command if different.

- [ ] **Step 3: Run frontend build**

```bash
npm run build --workspace=web
```

- [ ] **Step 4: Run full build**

```bash
npm run build
```

- [ ] **Step 5: Run migrations against local Postgres**

```bash
npm run db:migrate --workspace=server
```

- [ ] **Step 6: Run E2E tests**

```bash
npm run test:e2e
```

- [ ] **Step 7: Manual smoke test**

Test manually:

```text
landing page
pricing page
register/login/logout
email verify dev/test flow
billing checkout dev/test flow
billing portal dev/test flow
hosted onboarding
hosted contact/estate/switch flow
relay connection/link flow
heartbeat status
claim portal seeded flow
admin dashboard
production build start
```

- [ ] **Step 8: Alpha readiness doc**

Create `docs/alpha-readiness.md` with checklist:

```text
all unit tests pass
all E2E tests pass
production build succeeds
migrations run
Stripe webhook configured
Postmark configured
R2/S3 configured or disabled intentionally
Relay heartbeat works
Hosted claim portal works
Admin access restricted
No default secrets in production
CORS/cookies production-safe
Known limitations documented
```

- [ ] **Step 9: Completion notes**

Create `docs/phase4-completion-notes.md` with:

```text
implemented items
test results
manual smoke results
deployment notes
known limitations
recommended next phase
```

- [ ] **Step 10: Final commit**

```bash
git add -A
git commit -m "chore: complete phase 4 alpha polish for aegis dms site"
```

---

## Phase 4 Completion Criteria

Phase 4 is complete when:

```text
- New users can register, subscribe or enter test entitlement, and reach onboarding.
- Hosted onboarding guides users through trust acknowledgement and first setup steps.
- Relay users can create/manage Relay connections without URL API-key exposure.
- Relay heartbeat status is visible in the UI.
- Relay Escrow requires explicit versioned acknowledgement.
- Billing management page opens Stripe customer portal.
- Account/security settings work.
- Admin dashboard is useful and redacted.
- Railway deployment config and deployment docs exist.
- E2E tests cover marketing/auth/billing/hosted/relay/claim/admin flows.
- Full tests/build/migrations/E2E pass.
- Phase 4 completion notes exist.
```

---

## Recommended Next Phase

After Phase 4, the next logical SaaS work is **production hardening and public/private alpha onboarding**:

```text
- Real production deploy and DNS.
- Legal/terms/privacy pages.
- Support/contact flow.
- More billing edge cases.
- Operational alerting.
- Better email templates.
- Security review.
- Relay/Core integration testing with actual OSS instance.
- DeadDrop API design preview docs, not public launch yet.
```
