# Threat Model — Aegis DMS Site (SaaS)

Last updated: 2026-05-14
Status: Alpha — Phase 5 baseline

---

## Overview

Aegis DMS Site provides three hosted products: Aegis Relay (monitoring and escrow for self-hosted users), Aegis Hosted (fully managed legacy release for non-technical users), and the DeadDrop infrastructure layer (internal, not publicly exposed yet). The SaaS runs on Railway with a PostgreSQL database.

---

## Trust Boundaries

| Boundary | Trust Level | Notes |
|----------|-------------|-------|
| Authenticated user (session) | Full trust for their own data | Can create/read/update their own estate, contacts, switches, packets |
| Admin user | Elevated trust | Can view system metrics, user list, relay connections, release runs |
| Relay API key (OSS instance) | Limited trust | Can send heartbeats and initiate relay-assisted operations |
| Stripe webhook | External trusted | Verified by HMAC signature before processing |
| Postmark/Telegram | Untrusted transport | Receives notification content, not encryption keys |
| Railway/Render deployment | Infrastructure trust | Has access to env vars and DB connection strings |
| Other users | No cross-user access | All data is scoped by userId FK |

---

## Attack Surfaces

### 1. Registration and Login (`POST /api/auth/register`, `/api/auth/login`)

- **Threat:** Account takeover via brute force, credential stuffing
- **Mitigation:** Argon2id hashing. Constant-time comparison for password verification.
- **Gap:** No login rate limiting. No account lockout. Depends on Argon2 latency only.

### 2. Password Reset (`POST /api/auth/request-reset`, `/api/auth/reset-password`)

- **Threat:** Password reset token interception or brute force; user enumeration
- **Mitigation:** Token is `nanoid(32)` stored as SHA-256 hash. 15-minute expiry. Single-use (cleared on use). Response is always 200 (no enumeration).
- **Gap:** Email delivery not tested in production; reset token lives in DB until used or expired.

### 3. Session cookies

- **Threat:** Session hijacking (XSS, network sniffing)
- **Mitigation:** HttpOnly (no JS access), SameSite=Lax, Secure flag in production via Railway HTTPS.
- **Gap:** No explicit HSTS enforcement at app level (depends on Railway reverse proxy).

### 4. CSRF

- **Threat:** Cross-site request forgery via malicious page
- **Mitigation:** Time-bounded HMAC-SHA256 token required on all state-changing routes. 4-hour TTL. Session-bound.
- **Gap:** Token rotation on privilege change not implemented.

### 5. Cross-user data access

- **Threat:** User A accessing user B's estate items, contacts, switches, packets
- **Mitigation:** All DB queries are filtered by `userId` FK. No query can return another user's data.
- **Gap:** No formal authorization layer (simple FK filter). Bugs in query construction could leak data.

### 6. PostgreSQL database

- **Threat:** DB connection string leaked; direct DB access
- **Mitigation:** All PII fields encrypted with AES-256-GCM. Railway secrets management.
- **Gap:** Single server-level field encryption key. DB compromise + key compromise = full data exposure.

### 7. Relay API keys

- **Threat:** API key leaked → attacker can fake heartbeats or access relay status
- **Mitigation:** Keys stored as SHA-256 only. Transmitted as `Authorization: Bearer` header (not URL). Keys shown once at generation.
- **Gap:** No rotation notification. Manual rotation required.

### 8. Billing webhook (`POST /api/billing/webhook`)

- **Threat:** Fake Stripe events to grant paid features without payment; replay attacks
- **Mitigation:** Stripe HMAC signature verified before processing. Idempotency via `stripe_webhook_events` table (event ID uniqueness).
- **Gap:** In test mode with empty webhook secret, Stripe SDK init may fail with 500 rather than 400.

### 9. Admin routes

- **Threat:** Non-admin user accessing admin endpoints
- **Mitigation:** `role = 'admin'` checked server-side. Non-admin → 403. Unauthenticated → 401.
- **Gap:** Admin role assignment requires direct DB access or seeded email list. No UI for role management.

### 10. Relay escrow material

- **Threat:** Unauthorized access to or modification of escrow material
- **Mitigation:** Material stored encrypted. Only the owning user can manage their escrow. Release requires trust acknowledgement.
- **Gap:** Server-side encryption means Aegis SaaS CAN decrypt material. No zero-knowledge in v1.

### 11. Audit log

- **Threat:** PII accumulates in audit log
- **Mitigation:** `sanitizeAuditMetadata` recursively redacts known PII key patterns before write.
- **Gap:** Pattern-matching approach; novel PII field names not on the list could leak through.

### 12. Notification payloads

- **Threat:** PII stored in notification_events table
- **Mitigation:** `notification_events` stores only `contactId` FK, not plaintext email/phone.
- **Gap:** In-memory notification rendering contains decrypted email. Postmark delivery logs may store recipient addresses.

---

## In-Scope Threats

- Auth bypass (brute force, credential stuffing, session hijacking)
- Data exfiltration via DB compromise
- Claim spoofing (token interception or brute force)
- Relay compromise (fake heartbeats, unauthorized access)
- Billing manipulation (fake webhook events)
- Cross-user data access
- PII leakage into audit logs
- Admin route unauthorized access
- Notification abuse

---

## Out-of-Scope Threats (Alpha)

- Railway infrastructure compromise
- Supply chain attacks on npm dependencies
- Zero-knowledge escrow architecture
- Regulatory compliance (GDPR, HIPAA)
- DDoS
- Side-channel attacks
- Social engineering of users or contacts

---

## Known Gaps (to address before beta)

1. **No login rate limiting.** Critical for a multi-user SaaS.
2. **No account lockout.** After any number of failed attempts, brute force is limited only by Argon2 latency.
3. **No TOTP for SaaS users.** Account takeover via password alone.
4. **Single field encryption key.** Compromise = all user data exposed.
5. **No per-user key isolation.** A bug that decrypts one user's field could be applied to all.
6. **No formal security audit.** Required before production launch with real users.
7. **Billing webhook 500 in test mode.** Stripe SDK init with empty key throws. Not a production risk but obscures test coverage.

---

## Mitigations Summary

| Risk | Mitigation | Residual Risk |
|------|------------|---------------|
| Auth bypass | Argon2id, time-bounded CSRF | No lockout, no TOTP |
| Cross-user access | userId FK on all queries | Single auth layer, no ABAC |
| Data at rest | AES-256-GCM, HKDF-derived key | Single key for all users |
| Relay key exposure | SHA-256 stored only, header auth | Manual rotation only |
| Billing manipulation | Stripe HMAC + idempotency | SDK 500 in test mode |
| PII in audit log | Recursive sanitization on write | Pattern matching, not schema validation |
| Admin access | Role check server-side | No role management UI |
