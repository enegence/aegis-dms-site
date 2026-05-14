# Aegis DMS Site — Alpha Readiness Checklist

## Status: READY FOR ALPHA

Last updated: 2026-05-13

## Unit Tests
- [x] 449 server tests passing (41 test files)
- [x] 16 contracts tests passing
- [x] 0 failures

## E2E Tests
- [x] 31 Playwright E2E tests configured (6 spec files)
- [x] Tests parse and list correctly
- [ ] Full E2E run requires live dev server + test DB — not run in headless CI yet

## Build
- [x] Frontend (Vite) builds clean — 311 kB JS bundle
- [x] Server (TypeScript tsc) builds clean
- [x] Full `npm run build` succeeds

## Migrations
- [x] 7 migration files (0000–0006_onboarding + 0007_relay_link_codes)
- [x] `npm run db:migrate` runs cleanly

## Stripe
- [ ] Stripe webhook configured at https://your-domain/api/billing/webhook
- [ ] Products/prices created in Stripe dashboard
- [ ] STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_RELAY_PRICE_ID, STRIPE_HOSTED_PRICE_ID set in production

## Postmark
- [ ] Postmark server token created
- [ ] From email domain verified (DKIM + SPF)
- [ ] POSTMARK_API_TOKEN, POSTMARK_FROM_EMAIL set in production

## Storage (R2/S3)
- [ ] R2 bucket created (or AWS S3)
- [ ] Access keys provisioned
- [ ] AEGIS_STORAGE_* vars set in production (or left empty to disable)

## Relay Heartbeat
- [x] Relay monitoring worker implemented
- [x] Relay heartbeat API tested (server unit tests)
- [ ] End-to-end relay heartbeat tested with real OSS instance

## Hosted Claim Portal
- [x] Claim portal UI implemented and tested
- [x] Claim API tested (server unit tests)
- [ ] Manual smoke test with seeded release run not performed (headless environment)

## Admin Access
- [x] Admin routes protected by role check + AEGIS_ADMIN_EMAILS env allowlist
- [x] Sensitive data redacted from admin responses
- [ ] AEGIS_ADMIN_EMAILS set to operator email in production

## Production Security
- [x] No default secrets accepted in production (validateProductionConfig throws)
- [x] CORS allowlist enforced (AEGIS_BASE_URL, not wildcard)
- [x] Cookies: HttpOnly, SameSite=Lax, Secure in production
- [x] CSRF protection on all browser state-changing routes
- [x] API keys stored as SHA-256 hashes only
- [x] PII encrypted at rest (AES-256-GCM)
- [x] No PII in audit logs

## Railway Deployment
- [x] railway.toml configured
- [x] Dockerfile (multi-stage) present
- [x] .dockerignore present
- [x] docs/deployment.md documents all steps

## Known Limitations (Alpha)
- No TOTP / 2FA implementation
- No Shamir Secret Sharing
- No zero-knowledge guarantees
- No formal security audit
- No HA / multi-region deployment
- No legal/terms/privacy pages (placeholder only)
- Email change not supported (alpha limitation)
- RelayEscrowCard enable form requires contact/packet selection — UI is a skeleton
- E2E tests require running server for most flows
- Manual smoke test not performed in headless build environment
