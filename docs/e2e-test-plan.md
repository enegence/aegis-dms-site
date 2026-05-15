# E2E Test Plan — Aegis DMS Site

## Overview

End-to-end tests use Playwright against a real Fastify server + PostgreSQL. Tests run in CI on every PR and push to `main`. A separate nightly job runs cross-repo integration coverage (OSS ↔ SaaS Relay).

## Test Matrix

### SaaS Flows (`tests/e2e/`)

| Spec | Flows Covered |
|------|--------------|
| `marketing-auth.spec.ts` | Landing, Pricing, Register, Login, Logout, Password reset |
| `legal-pages.spec.ts` | All 6 legal pages render, terms checkbox on register, legal links in footer |
| `hosted-onboarding.spec.ts` | Onboarding picker, hosted trust model step, trust ack CTA, checklist |
| `estate-contacts.spec.ts` | Estate item create (API), Contact create (API), page reflects data |
| `switches.spec.ts` | Switch create, arm readiness check (422), check-in |
| `relay-connection.spec.ts` | Relay page load, add connection UI, link flow, rotate/revoke |
| `relay-escrow.spec.ts` | Escrow status, ack flow, enable without ack (409) |
| `billing.spec.ts` | Pricing page, checkout button, billing page, portal link |
| `claim-portal.spec.ts` | Invalid token, valid token claim landing, already acknowledged, expired |
| `account-settings.spec.ts` | Settings page, export data (200 + JSON), delete with wrong password (401), delete success |
| `admin.spec.ts` | Non-admin redirect, dashboard metrics, user list, health panel |

### OSS Flows (`aegis/` repo)

OSS E2E tests live in the `aegis/` repo at `web/tests/e2e/`. See `aegis/docs/e2e-test-plan.md`.

Required flows:
- Setup owner (first-run wizard)
- Login
- Create estate item
- Create contact
- Configure Vault Mode switch
- Arm switch
- Check-in
- Simulate trigger (advance clock in test mode)
- Claim flow (via claim portal stub)
- Export backup
- Restore preview

### Relay Cross-Repo Integration

#### PR Path (Mocked)

For fast PR checks, Relay integration uses:
- A mocked SaaS Relay server in OSS tests (validates heartbeat protocol without a real SaaS instance)
- A seeded relay connection + mocked heartbeat source in SaaS tests

Both are implemented in their respective `tests/e2e/` directories.

#### Nightly / Release-Gate (Real)

A nightly workflow (`.github/workflows/nightly-integration.yml`) runs with:
1. A real OSS instance (Docker Compose, SQLite)
2. A real SaaS instance (Docker Compose, PostgreSQL)
3. OSS authenticates to SaaS Relay via auth-code exchange
4. OSS sends heartbeats; SaaS marks relay connection active
5. Missed heartbeat → SaaS marks offline → alerts fire (stubbed email)
6. Relay Escrow: trust ack → enable → verify escrow material stored

**Nightly job config** (`.github/workflows/nightly-integration.yml`):
```yaml
on:
  schedule:
    - cron: '0 3 * * *'  # 03:00 UTC daily
  workflow_dispatch: {}
```

## Running Locally

```bash
# Start Postgres (Docker Compose dev environment)
docker compose up -d db

# Run migrations
npm run db:migrate

# Start API server
cd server && npm run dev &

# Start Vite dev server  
cd web && npm run dev &

# Run E2E tests
npm run test:e2e

# Run with Playwright UI
npm run test:e2e:ui
```

## Test Seed Endpoint

Several E2E tests use `POST /api/test/seed-subscription` to bypass Stripe and directly seed an active subscription. This endpoint is only active when `AEGIS_TEST_SEED=true`.

```bash
AEGIS_TEST_SEED=true AEGIS_TEST_SECRET=test-secret npm run dev
```

## Screenshot and Trace Artifacts

On test failure in CI, Playwright saves:
- Screenshots: `playwright-report/`
- Traces: enabled on first retry (`trace: 'on-first-retry'`)

Artifacts are uploaded to GitHub Actions for 7 days.

## Coverage Gaps (Alpha Limitations)

- **Trigger simulation**: Full end-to-end trigger (switch trip → release run → contact notify) requires advancing the worker clock. Not yet implemented in E2E harness. Covered by server unit tests in `tests/switches.test.ts` and `tests/release-run.test.ts`.
- **Email delivery**: Postmark calls are stubbed in all test environments. Actual delivery is manual-tested against a staging Postmark account before release.
- **SMS**: Not implemented.
- **TOTP flows**: Covered by OSS E2E; not applicable to SaaS (no TOTP in SaaS auth currently).
- **Real Stripe checkout**: Tested with Stripe CLI webhook forwarding in local dev; CI uses mocked responses.
