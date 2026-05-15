# Release Checklist — Aegis DMS

Use this checklist before every significant release (beta launch, GA, point releases).

---

## Code Quality

- [ ] All server unit tests pass (`npm test` — currently 615 tests)
- [ ] All contract tests pass
- [ ] TypeScript build succeeds (`npm run build`)
- [ ] No `TODO(release)` or `FIXME(release)` markers in the codebase
- [ ] No hardcoded test credentials, API keys, or "change-me" secrets committed
- [ ] Server refuses to start if secrets are `< 32 chars` or contain `change-me` (enforced by config validation)

## Security

- [ ] Security checklist reviewed (`docs/security-checklist.md`)
- [ ] Threat model reviewed for new attack surfaces (`docs/threat-model.md`)
- [ ] No plaintext PII in audit logs (grep for email/phone in audit log writes)
- [ ] No secrets in server logs (pino redact config verified)
- [ ] All encrypted fields use `*Encrypted` column naming convention
- [ ] Argon2id used for all password hashing (no bcrypt/md5)
- [ ] CSRF protection active on all state-changing routes
- [ ] HttpOnly + Secure + SameSite cookies in production
- [ ] Rate limiting verified on: login, register, password reset, claim endpoints
- [ ] CORS allowlist explicitly set (no wildcard in production)
- [ ] Security page (`/security`) is accurate and up to date

## E2E Tests

- [ ] All 65 E2E specs pass against a live dev stack (`npm run test:e2e`)
- [ ] No test uses `page.waitForTimeout` without a comment explaining why
- [ ] Screenshots / traces reviewed if any tests are skipped or flaky

## Legal / Trust

- [ ] Legal pages (`/terms`, `/privacy`, `/security`, `/disclaimers`, `/acceptable-use`, `/data-deletion`) are live
- [ ] Legal pages reviewed by legal counsel (required for GA, not beta)
- [ ] Terms version matches `trust_acknowledgements` version constant (`terms-v1`)
- [ ] Known limitations doc is accurate (`docs/known-limitations.md`)
- [ ] Alpha/beta notice banners present on legal pages (remove for GA)

## Data and Privacy

- [ ] Account export tested: `GET /api/account/export` returns valid JSON archive
- [ ] Account deletion tested: `DELETE /api/account/delete` removes user + cascade
- [ ] Export does not include plaintext encrypted fields (encrypted envelopes only)
- [ ] Audit logs verified to contain no plaintext PII

## Notifications

- [ ] Email delivery tested with real Postmark credentials
- [ ] `notification_deliveries` retry logic verified (max 3 retries, backoff)
- [ ] Postmark webhook ingest verified (`POST /api/notifications/postmark/webhook`)
- [ ] Telegram bot token active and verified (if configured)

## Worker and Release

- [ ] Worker heartbeat persisting to `worker_heartbeats` table
- [ ] Worker restart recovery tested (one active run per user, idempotency_keys)
- [ ] Release-run duplicate prevention tested (concurrent trigger → only one run starts)
- [ ] Release-run state machine tested for all transitions

## Billing

- [ ] Stripe webhook configured and verified in production Stripe dashboard
- [ ] Stripe products and price IDs set in production env vars
- [ ] All 9 Stripe lifecycle event types handled (`customer.subscription.*`)
- [ ] Idempotent webhook replay tested (same event twice → no duplicate state change)

## Infrastructure

- [ ] Railway production environment variables set (see `docs/deployment.md`)
- [ ] Production domain DNS and TLS configured
- [ ] Cookie `Secure` flag active in production
- [ ] Database backup strategy in place
- [ ] Rollback procedure documented and tested (`docs/deployment.md`)

## Documentation

- [ ] README.md reflects current state
- [ ] `docs/known-limitations.md` updated for this release
- [ ] `docs/deployment.md` accurate for Railway production
- [ ] `docs/operations.md` accurate
- [ ] `docs/hosted.md` and `docs/relay.md` accurate

## Post-Deploy Smoke Test

Run these manually after deploying to production:

- [ ] `GET /api/health` returns `{ status: "ok" }`
- [ ] `GET /api/health/details` returns worker + DB metrics
- [ ] Landing page loads (`/`)
- [ ] Register form works end-to-end
- [ ] Login works
- [ ] Stripe checkout redirects correctly
- [ ] Postmark: manually trigger a test email send
- [ ] Admin dashboard loads for admin user

---

## GA-Specific Additional Checks

These are not required for beta but must be completed before general availability:

- [ ] Legal pages reviewed and approved by legal counsel
- [ ] Third-party security audit complete
- [ ] Formal penetration test complete
- [ ] GDPR/CCPA compliance formally assessed
- [ ] SOC 2 scope defined (if applicable)
- [ ] Production SLA documented
- [ ] Branded email templates deployed
- [ ] Public issue tracker / support portal live
- [ ] Pricing finalized and published
