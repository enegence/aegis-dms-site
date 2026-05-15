# Aegis DMS Site — Beta Readiness

Last updated: 2026-05-14

## Status: COMPLETE (Phase 5)

This document tracks progress toward beta readiness. Alpha-readiness was declared at the end of Phase 4. Phase 5 (this document) tracks the additional hardening required for a public beta. All 11 Phase 5 tasks are complete.

---

## Phase 5 Progress

### Completed

- [x] **Task 1**: Cross-repo security review — threat model, security checklist, auth/session/CSRF, audit log redaction, encrypted-field validation, rate-limit coverage (OSS: 343 tests, SaaS: 483 tests)
- [x] **Task 2**: Release-run idempotency and recovery — state transition guards, one-active-run enforcement, atomic `idempotency_keys` table, worker restart recovery (OSS: 370 tests, SaaS: 506 tests)
- [x] **Task 3**: Notification delivery reliability — `notification_deliveries` table, retry/backoff, payload minimization, Postmark webhook ingestion (OSS: 413 tests, SaaS: 563 tests)
- [x] **Task 4**: Backup, export, restore, and deletion — OSS encrypted export, SaaS account export, SaaS account deletion flow (OSS: 427 tests, SaaS: 576 tests)
- [x] **Task 5**: Observability, health, and operational readiness — structured redacted logs, detailed health endpoints, worker heartbeat persistence, admin metrics and alerting (OSS: 440 tests, SaaS: 591 tests)
- [x] **Task 6**: SaaS admin hardening, billing lifecycle, support runbook — admin 403 enforcement, full Stripe lifecycle (9 event types), idempotent webhook replay, UserDetail view (SaaS: 610 tests)
- [x] **Task 7**: Legal and trust pages — `/terms`, `/privacy`, `/security`, `/acceptable-use`, `/disclaimers`, `/data-deletion`; terms acceptance on signup; `trust_acknowledgements` write at registration (615 tests)
- [x] **Task 8**: Beta E2E test matrix — 65 E2E specs (11 spec files), CI workflow, `docs/e2e-test-plan.md`

- [x] **Task 9**: Beta documentation — known limitations, release checklist, DeadDrop architecture doc, DeadDrop API preview
- [x] **Task 10**: OSS Relay linking, TOTP recovery codes, owner password change, rate-limit carryovers, provider coverage, accessibility polish
- [x] **Task 11**: Production deployment, email templates, operator alerting, OSS beta release packaging

---

## Current Test Counts

| Suite | Count | Status |
|-------|-------|--------|
| SaaS server unit tests | 615 | ✓ passing |
| Contract tests | 16 | ✓ passing |
| E2E specs | 65 | ✓ parse + list; run requires live stack |
| OSS server unit tests | ~440 | ✓ passing (in `aegis/` repo) |

---

## Beta Requirements — Status

### Security (required for beta)

- [x] No plaintext PII in audit logs
- [x] No secrets in server logs (pino redact)
- [x] CSRF on all state-changing routes
- [x] HttpOnly + SameSite cookies
- [x] Rate limiting: login, register, reset, claim endpoints
- [x] AES-256-GCM field encryption for all PII
- [x] Argon2id password hashing
- [x] CORS allowlist (no wildcard with credentials)
- [x] Server refuses to start with weak/default secrets
- [ ] Third-party security audit — NOT YET (planned for GA)

### Features (required for beta)

- [x] Register / login / reset password
- [x] Email verification
- [x] Hosted estate items, contacts, switches
- [x] Relay monitoring
- [x] Relay escrow (with trust acknowledgement)
- [x] Contact cascade and claim portal
- [x] Stripe subscription lifecycle
- [x] Account export and deletion
- [x] Admin dashboard
- [x] Legal pages with terms acceptance
- [x] Branded email templates (Task 11)
- [x] OSS Relay auth-code linking (Task 10)
- [x] TOTP recovery codes (OSS) (Task 10)

### Documentation (required for beta)

- [x] `docs/deployment.md`
- [x] `docs/operations.md`
- [x] `docs/security-checklist.md`
- [x] `docs/threat-model.md`
- [x] `docs/support-runbook.md`
- [x] `docs/e2e-test-plan.md`
- [x] Legal pages (`/terms`, `/privacy`, etc.)
- [x] `docs/known-limitations.md`
- [x] `docs/release-checklist.md`
- [x] `docs/deaddrop-architecture.md`
- [x] `docs/deaddrop-api-preview.md`
- [x] `docs/beta-readiness.md` updates complete after Task 9
- [x] Accessibility doc (`docs/accessibility.md`)

### Infrastructure (required for beta)

- [x] Railway deployment configured
- [x] Multi-stage Docker build
- [x] CI workflow (`.github/workflows/test.yml`)
- [x] Production domain and DNS (Task 11)
- [x] Stripe production webhook configured (Task 11)
- [x] Branded email templates (Task 11)

---

## Known Limitations for Beta

See `docs/known-limitations.md` for the full list. Key points:

- No third-party security audit
- No TOTP in SaaS
- No guaranteed delivery SLA
- No HA deployment
- Legal pages are working drafts (not legally reviewed)
- Pricing is placeholder
- No public DeadDrop API
