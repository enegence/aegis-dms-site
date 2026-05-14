# Security Review — Aegis DMS Site (SaaS)

**Date:** 2026-05-14
**Reviewer:** Claude / Automated (Phase 5 Task 1)
**Scope:** SaaS repo (`aegis-dms-site/`) — all server code through Phase 4 + Phase 5 Task 1
**Status:** Alpha baseline — not a formal security audit

---

## What Was Checked

1. Authentication and registration flow
2. Session management (creation, expiry, logout)
3. CSRF protection (time-bounded token, global hook)
4. Password reset token (hash storage, single-use, expiry)
5. Field encryption (contacts, estate items, escrow material)
6. Packet encryption (per-packet keys)
7. Audit log redaction (recursive `sanitizeAuditMetadata`)
8. Billing webhook validation (Stripe HMAC)
9. Admin route authorization (role-based)
10. Relay API key handling (hash-only storage)
11. User data scoping (userId FK on all queries)
12. Production config validation (`validateProductionConfig`)

---

## What Passed

| Area | Finding |
|------|---------|
| Password hashing | Argon2id — correct choice for user passwords |
| Field encryption | AES-256-GCM with HKDF-SHA256 key derivation. All PII columns use `*Encrypted` naming. |
| Claim tokens | High-entropy random, stored as SHA-256 only. Plaintext never persisted. |
| Relay API keys | SHA-256 stored only. Header auth (not URL). Shown once at generation. |
| Password reset | nanoid(32) stored as SHA-256 hash. 15-minute expiry. Single-use. No user enumeration. |
| Relay link codes | SHA-256 stored only. State parameter for CSRF protection. Expiry enforced. |
| Session management | HttpOnly cookie, SameSite=Lax, logout deletes server-side session, expiry enforced |
| CSRF protection | Time-bounded HMAC-SHA256 (4-hour TTL), session-bound, global onRequest hook |
| Billing webhook | Stripe HMAC verified, idempotency via `stripe_webhook_events` table |
| Admin authorization | Role check server-side (403 non-admin, 401 unauthenticated) |
| Audit log | Recursive `sanitizeAuditMetadata` with exact-match and suffix-pattern redaction |
| Production config | `validateProductionConfig` rejects default values, localhost URLs, missing Stripe/Postmark secrets |
| User data scoping | All queries filter by `userId` FK; cross-user access tests in estate/contact tests |
| Escrow material | `materialEncrypted` is `NOT NULL`; plaintext escrow material never stored |
| CORS | Explicit origin allowlist; no wildcard with credentials |

---

## Known Gaps (Not Blocking Alpha)

| Gap | Severity | Notes |
|-----|----------|-------|
| No login rate limiting | High | Required for production multi-user SaaS. Currently only Argon2 latency. |
| No account lockout | High | Brute force limited only by Argon2. Add server-level throttle in Phase 5. |
| No TOTP for SaaS users | Medium | Account takeover via password alone. Future work. |
| Single field encryption key | Medium | All user data under one key. Per-user key isolation deferred to beta. |
| No key rotation path | Medium | Re-encrypting all rows requires a migration script. Not yet built. |
| No formal external security audit | High | Required before production/regulated-data launch. |
| Billing webhook SDK 500 in test mode | Low | Stripe SDK init with empty key throws. Not a production risk. |
| Audit pattern matching | Low | New PII field names not on the blocklist could slip through. |
| Claim PIN brute-force throttle not DB-backed | Medium | In-memory only (if implemented). Resets on restart. |
| No account deletion with encrypted-field zeroing | Medium | Phase 5 item. Current delete removes rows without zeroing ciphertext. |

---

## Deferred Items

The following are architectural decisions deferred to beta/GA:

- Per-user key derivation (password-keyed encryption)
- HSM/KMS integration for master key custody
- Zero-knowledge hosted encryption
- Zero-knowledge relay escrow
- Client-side encryption option
- SOC 2 / formal compliance audit

---

## Test Coverage Summary

| Test file | What it proves |
|-----------|----------------|
| `tests/security-baseline.test.ts` | CSRF enforcement, logout, startup validation, field encryption in DB, audit redaction, admin auth, billing webhook rejection |
| `tests/csrf.test.ts` | No token → 403, invalid → 403, valid → accepted, cross-session → rejected |
| `tests/auth-routes.test.ts` | Register/login/logout/reset request |
| `tests/audit.test.ts` | `sanitizeAuditMetadata` unit tests, PII redaction |
| `tests/estate.test.ts` | CRUD, encryption in DB, CSRF enforcement, audit log no-PII |
| `tests/contacts.test.ts` | CRUD, email/fullName encryption in DB |
| `tests/field-encryption-domain.test.ts` | Encryption round-trip |
| `tests/admin-routes.test.ts` | Non-admin 403, unauthenticated 401, admin access |
| `tests/relay-connections.test.ts` | API key hash storage, revocation |
| `tests/relay-link.test.ts` | Auth-code linking flow |
| `tests/billing.test.ts` | Checkout, portal, webhook basics |
| `tests/hosted-claim-routes.test.ts` | Claim token validation |
| `tests/packet-crypto.test.ts` | Packet encryption round-trip |

Total test count at review: 480 passing (SaaS server) + 6 todos for unimplemented gaps.

---

## Sign-off

This is an **automated alpha baseline review**, not a formal security audit. The codebase implements the security invariants defined in the architecture docs. The known gaps are documented and tracked.

**Recommendation:** Do not deploy to production with real user data until:
1. Login rate limiting is implemented
2. TOTP for SaaS users is implemented
3. A formal security review or pen test is conducted
4. Per-user key isolation is implemented or users are clearly informed of the shared-key limitation
