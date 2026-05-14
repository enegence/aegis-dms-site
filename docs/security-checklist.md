# Security Checklist — Aegis DMS Site (SaaS)

Last updated: 2026-05-14
Reviewer: Automated (Claude / Phase 5 Task 1)
Status: Alpha — see Known Limitations

---

## Authentication

**Required behavior:** Multi-user registration and login with email + password. Sessions via HttpOnly cookies. Default secrets rejected in production.

**Implemented files:**
- `server/src/auth/password.ts` — Argon2id hashing and verification
- `server/src/auth/session.ts` — nanoid session IDs, 7-day TTL, expiry enforcement, delete on logout
- `server/src/routes/auth.ts` — register, login, logout, verify-email, request-reset, reset-password
- `server/src/config.ts` — `validateProductionConfig` rejects `change-me`, short keys, localhost URLs

**Tests proving behavior:**
- `server/tests/auth-routes.test.ts` — register, login, logout, request-reset
- `server/tests/security-baseline.test.ts` — fabricated session rejected, logout invalidates, startup validation

**Known limitations:**
- No account lockout after N failed password attempts
- Sessions do not rotate on privilege change
- No multi-device session management

---

## Session Management

**Required behavior:** Sessions have a 7-day TTL. Expired sessions rejected and deleted on access. Logout invalidates server-side.

**Implemented files:**
- `server/src/auth/session.ts` — `SESSION_TTL_MS = 7 days`
- `server/src/db/schema.ts` — `sessions` table

**Tests proving behavior:**
- `server/tests/security-baseline.test.ts` — logout → 401, fabricated session → 401

**Known limitations:** No sliding expiry. Expired sessions accumulate until accessed.

---

## CSRF Protection

**Required behavior:** All state-changing API routes require `X-CSRF-Token` with a time-bounded, session-bound HMAC token. Token has a 4-hour TTL.

**Implemented files:**
- `server/src/auth/csrf.ts` — `generateCsrfToken` (HMAC-SHA256 with timestamp), `validateCsrfToken`
- `server/src/index.ts` — global `onRequest` hook validates CSRF for all state-changing routes except exempt paths

**Exempt paths (no CSRF required):**
- `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/request-reset`, `/api/auth/verify-email`
- `/api/billing/webhook`
- `/api/relay/heartbeat`
- `/api/relay/link/exchange`
- `/api/claim/` (claim portal — token-authenticated)

**Tests proving behavior:**
- `server/tests/csrf.test.ts` — no token → 403, invalid token → 403, valid → accepted, cross-session token → rejected
- `server/tests/security-baseline.test.ts` — same

**Known limitations:** None significant; time-bounded tokens are stronger than OSS CSRF implementation.

---

## Password Reset

**Required behavior:** Token generated via `nanoid(32)`, stored as `SHA-256` hash. 15-minute expiry. Single-use (token cleared after use). Endpoint returns 200 for both valid and invalid emails (no user enumeration).

**Implemented files:**
- `server/src/routes/auth.ts` — `POST /api/auth/request-reset`, `POST /api/auth/reset-password`
- `server/src/db/schema.ts` — `users.passwordResetTokenHash`, `users.passwordResetExpiresAt`

**Tests proving behavior:**
- `server/tests/security-baseline.test.ts` — token stored as 64-char hex (SHA-256), no user enumeration
- `server/tests/auth-routes.test.ts` — accepts both valid and non-existent email (200)

**Known limitations:** Single-use enforced by clearing hash on use — confirmed in route code. End-to-end test requires email delivery mocking (future).

---

## TOTP

**Required behavior:** TOTP not yet implemented in SaaS auth flow. Users use password + email-based authentication only.

**Implemented files:** None for SaaS TOTP

**Tests proving behavior:** `server/tests/security-baseline.test.ts` — `it.todo`

**Known limitations:** TOTP for SaaS accounts is not implemented in alpha. Future work.

---

## Field Encryption

**Required behavior:** All PII fields encrypted at rest with AES-256-GCM. Key derived via HKDF-SHA256 with `aegis-field-encryption-v1` context. Never logged, never in audit events.

**Implemented files:**
- `server/src/services/field-encrypt.ts` — `encryptField`, `decryptField`, `encryptFieldIfPresent`, `decryptFieldIfPresent` (HKDF derivation)
- `server/src/db/schema.ts` — all `*Encrypted` columns in `estateItems` and `contacts`
- `server/src/services/estate.ts` and `contacts.ts` — encrypt on write, decrypt on read

**Tests proving behavior:**
- `server/tests/estate.test.ts` — `institutionNameEncrypted` not plaintext in DB
- `server/tests/contacts.test.ts` — `emailEncrypted` not plaintext in DB
- `server/tests/security-baseline.test.ts` — institutionName, executorNotes, assetDescription, email, fullName all verified not plaintext
- `server/tests/field-encryption-domain.test.ts` — encryption round-trip

**Known limitations:**
- Single server-level field encryption key (not per-user)
- No key rotation path in alpha

---

## Packet Encryption

**Required behavior:** Packets AES-256-GCM encrypted. Per-packet keys stored encrypted in `encryption_keys`. Packet key encrypted with `packetKeyEncrypted` column in `packets`.

**Implemented files:**
- `server/src/services/packet-crypto.ts`
- `server/src/db/schema.ts` — `packets.packetKeyEncrypted`, `encryption_keys.keyMaterialEncrypted`

**Tests proving behavior:**
- `server/tests/packet-crypto.test.ts`
- `server/tests/hosted-packet-builder.test.ts`

**Known limitations:** Same single-key limitation as field encryption.

---

## Release-Run Authorization

**Required behavior:** Release runs created only by worker/cascade service. One active run per user/switch at a time.

**Implemented files:**
- `server/src/services/hosted-release-run.ts`
- `server/src/services/hosted-cascade.ts`

**Tests proving behavior:**
- `server/tests/hosted-release-run.test.ts`
- `server/tests/hosted-cascade.test.ts`

**Known limitations:** No admin override for stuck release runs in Phase 4/5.

---

## Claim Token Safety

**Required behavior:** Claim tokens are high-entropy random values stored as SHA-256 hash. Plaintext only in outbound notification URLs.

**Implemented files:**
- `server/src/db/schema.ts` — `contact_claims.claim_token_hash`
- `server/src/services/hosted-cascade.ts` — token generation

**Tests proving behavior:**
- `server/tests/hosted-claim-routes.test.ts`

**Known limitations:** Claim brute-force throttling not yet implemented.

---

## Contact Verification

**Required behavior:** Contact claim flow requires token-based verification through the claim portal.

**Implemented files:** `server/src/routes/claim.ts`

**Tests proving behavior:** `server/tests/hosted-claim-routes.test.ts`

**Known limitations:** Claim PIN brute-force throttling `it.todo` — not yet implemented.

---

## Relay Linking

**Required behavior:** OSS instances link to SaaS via authorization-code exchange. API key passed as `Authorization` header, never in URL query string.

**Implemented files:**
- `server/src/routes/relay-link.ts` — auth-code initiation and exchange
- `server/src/services/relay-link.ts` — code hash storage, exchange

**Tests proving behavior:**
- `server/tests/relay-link.test.ts`

**Known limitations:** The authorization-code exchange with the OSS instance is not yet fully end-to-end tested with a real OSS server.

---

## API Key Handling

**Required behavior:** Relay API keys stored as `SHA-256(raw_key)` only. Shown to user once at creation. Never passed in URL query strings. Revoked connections reject all requests.

**Implemented files:**
- `server/src/services/relay-auth.ts` — `generateApiKey`, `hashApiKey`
- `server/src/routes/relay.ts` — heartbeat uses `Authorization: Bearer <api_key>` header

**Tests proving behavior:**
- `server/tests/relay-connections.test.ts`

**Known limitations:** None in Phase 4. Good implementation.

---

## Audit Log Redaction

**Required behavior:** `sanitizeAuditMetadata` recursively redacts known PII keys before any audit event is written. Events are NOT rejected (unlike OSS) — they are sanitized and written.

**Implemented files:**
- `server/src/services/audit.ts` — `sanitizeAuditMetadata`, `writeAuditEvent`

**Tests proving behavior:**
- `server/tests/audit.test.ts` — sanitizeAuditMetadata unit tests (exact keys, suffix patterns, nested, arrays)
- `server/tests/security-baseline.test.ts` — contact_created and estate_item_created events contain no PII

**Known limitations:** Sanitization is comprehensive but relies on key-name pattern matching. New PII fields with non-matching names could slip through.

---

## Admin Route Authorization

**Required behavior:** Admin routes require `role = 'admin'` in the DB. Non-admin users get 403. Unauthenticated get 401. Admin role is set only via server-side DB update (cannot be set via API).

**Implemented files:**
- `server/src/routes/admin.ts` — `requireAdmin` middleware
- `server/src/db/schema.ts` — `users.role`

**Tests proving behavior:**
- `server/tests/admin-routes.test.ts` — non-admin → 403, unauthenticated → 401
- `server/tests/security-baseline.test.ts` — same

**Known limitations:** Admin role assignment requires direct DB access or a seeded admin email list. No admin promotion UI.

---

## Billing Webhook Validation

**Required behavior:** Stripe webhook signature verified via `stripe.webhooks.constructEvent`. Missing or invalid signature returns 400. Idempotency: each event ID processed only once.

**Implemented files:**
- `server/src/routes/billing.ts` — webhook handler with `stripe.webhooks.constructEvent`
- `server/src/db/schema.ts` — `stripe_webhook_events` table for idempotency

**Tests proving behavior:**
- `server/tests/security-baseline.test.ts` — missing/invalid signature returns non-2xx; code analysis confirms 400 path
- `server/tests/billing.test.ts`

**Known limitations:** In test mode Stripe SDK cannot be fully exercised (empty secret key causes 500). Production behavior (400 for bad signature) is verified at code level.

---

## Storage Credential Handling

**Required behavior:** Storage credentials are NOT stored in the database for SaaS. Managed storage uses Railway/server env vars.

**Implemented files:**
- `server/src/config.ts` — storage config from env vars
- `server/src/services/storage/` — uses config values at runtime

**Tests proving behavior:** `server/tests/managed-storage.test.ts`

**Known limitations:** Credentials in environment variables on Railway. No HSM.

---

## Notification Payload Minimization

**Required behavior:** `notification_events` table stores only `contactId` FK reference, not plaintext email. `recipientRef` column is a redacted reference.

**Implemented files:**
- `server/src/db/schema.ts` — `notification_events` comment: "no plaintext recipient addresses stored"
- `server/src/services/notification-events.ts`

**Tests proving behavior:** `server/tests/hosted-notifications.test.ts`

**Known limitations:** Rendered email bodies (in-memory) contain the decrypted email. This is necessary for delivery.

---

## Rate Limiting

**Required behavior:** Login, register, password reset endpoints should be rate-limited.

**Implemented files:** Not yet implemented in Phase 4.

**Tests proving behavior:** `server/tests/security-baseline.test.ts` — `it.todo`

**Known limitations:** No rate limiting implemented. Critical gap for production.

---

## Backup/Export Handling

**Required behavior:** Not yet implemented.

**Known limitations:** Phase 5 item.

---

## Account Deletion

**Required behavior:** Not yet implemented.

**Known limitations:** Phase 5 item. Must zero encrypted fields before row deletion.
