# Key Management — Aegis DMS Site (SaaS)

Last updated: 2026-05-14
Status: Alpha — Phase 5 baseline

---

## Current Alpha Model

Aegis DMS Site uses **server-side encryption with server-managed keys**. No Shamir Secret Sharing. No HSM. No zero-knowledge claims for v1. The SaaS server holds all keys.

---

## Keys in Use

### Field Encryption Key (`AEGIS_FIELD_ENCRYPTION_KEY`)

- **Purpose:** Encrypts all PII fields in the database (contact names, emails, phones, estate institution names, executor notes, relay escrow material, etc.)
- **Format:** Any string ≥ 32 characters in production (not the default value)
- **Storage:** Environment variable on Railway. Never persisted in the database.
- **Derivation:** HKDF-SHA256 with info string `aegis-field-encryption-v1` → 32-byte AES key
- **Algorithm:** AES-256-GCM with per-field random 12-byte IV and 16-byte auth tag
- **Storage format:** `base64(iv + authTag + ciphertext)`
- **Where used:**
  - `server/src/services/field-encrypt.ts` — `encryptField` / `decryptField`
  - All `*Encrypted` columns in `estate_items` and `contacts` tables
  - `relay_escrow_materials.materialEncrypted`
  - `encryption_keys.keyMaterialEncrypted`
  - `users.totpSecretEncrypted` (if TOTP is added to SaaS in future)

### Secret Key (`AEGIS_SECRET_KEY`)

- **Purpose:** HMAC for CSRF token generation/validation and cookie signing
- **Format:** Minimum 32 characters in production (not `change-me`)
- **Storage:** Environment variable on Railway
- **Where used:**
  - `server/src/auth/csrf.ts` — `generateCsrfToken`, `validateCsrfToken` (HMAC-SHA256 with timestamp)
  - `@fastify/cookie` — signs cookie value

### Session Token (in-process)

- **Purpose:** Identifies an authenticated user session
- **Format:** nanoid(48) — 48 random characters
- **Storage:** `sessions` table in PostgreSQL
- **Lifetime:** 7 days from creation
- **Security properties:** Random enough to be unguessable; deleted on logout

### Packet Key (per-packet)

- **Purpose:** Encrypts the release packet contents
- **Format:** 32 random bytes
- **Storage:** Encrypted with the field encryption key and stored in `packets.packetKeyEncrypted` or `encryption_keys.keyMaterialEncrypted`
- **Lifecycle:**
  ```
  generatePacketKey() → 32 random bytes
  encryptField(key.toString('base64'), fieldEncryptionKey) → stored in packets.packetKeyEncrypted
  ...release event...
  loadPacketKey(db, packetId) → reads packetKeyEncrypted
  decryptField(packetKeyEncrypted, fieldEncryptionKey) → raw key bytes
  → returned to verified contact in claim key-view response
  → NOT stored anywhere after delivery
  ```

### Claim Token (per-claim)

- **Purpose:** One-time URL token for a contact to access their specific claim
- **Format:** nanoid(32) or `crypto.randomUUID()` — high entropy
- **Storage:** SHA-256 hash stored in `contact_claims.claim_token_hash`. Plaintext never persisted.
- **Transmission:** Included in outbound notification URL only. Not in any log or DB row.

### Relay API Key (per-connection)

- **Purpose:** Authenticates an OSS instance's heartbeat and relay requests
- **Format:** Random 32-byte value with `rlk_` prefix
- **Storage:** SHA-256 hash stored in `relay_connections.apiKeyHash`. Plaintext never persisted after generation.
- **Transmission:** Shown to user once at creation. Sent as `Authorization: Bearer <key>` header.

### Password Reset Token (per-request)

- **Purpose:** One-time token to authorize a password reset
- **Format:** nanoid(32)
- **Storage:** SHA-256 hash stored in `users.passwordResetTokenHash`. 15-minute expiry. Single-use.
- **Transmission:** Sent via email only. Never stored as plaintext.

### Relay Link Code (per-linking-session)

- **Purpose:** One-time authorization code for linking an OSS instance to Relay
- **Format:** `nanoid(32)` or similar
- **Storage:** SHA-256 hash in `relay_link_codes.codeHash`. Includes `state` parameter for CSRF protection. Expiry enforced.
- **Transmission:** URL parameter in the Relay portal → callback to OSS instance.

---

## Trust Model

```
Railway Env Vars
    │
    ├── AEGIS_FIELD_ENCRYPTION_KEY
    │       │
    │   ┌───┴───────────────────────────────────┐
    │   ▼                                       ▼
    │ PostgreSQL columns                 S3 Packets
    │ (ciphertext only)                  (ciphertext only)
    │
    └── AEGIS_SECRET_KEY
            │
        Cookie signing + CSRF HMAC
```

**Trust chain:** Everything depends on Railway environment variable security. If an attacker reads Railway env vars, all data can be decrypted.

---

## Alpha Limitations

| Feature | Status |
|---------|--------|
| Shamir Secret Sharing | Not implemented |
| HSM-backed key storage | Not implemented |
| Per-user derived keys | Not implemented (single key for all users) |
| Key rotation | Not implemented (would require re-encrypting all rows) |
| Zero-knowledge hosted encryption | Not implemented (server can decrypt) |
| Zero-knowledge relay escrow | Not implemented (server can decrypt material) |
| TOTP for SaaS users | Not implemented |

---

## What Changes in Beta / GA

1. **Per-user key derivation** — derive a user-specific key from the master key + user ID so that one user's key compromise doesn't affect others. This also enables password-keyed encryption.
2. **Key rotation tooling** — migration script to re-encrypt all fields with a new master key.
3. **HSM/KMS integration** — move master key to AWS KMS or Railway Vault for hardware-backed security.
4. **TOTP for SaaS** — TOTP secrets stored encrypted per-user.
5. **Zero-knowledge option** — client-side encryption for users who want it (complex; long-term roadmap).

---

## Security Non-Negotiables

1. `AEGIS_FIELD_ENCRYPTION_KEY` is NEVER written to the database, logs, or audit events.
2. `AEGIS_SECRET_KEY` is NEVER returned in any API response.
3. Packet keys are NEVER stored decrypted. Transiently decrypted in-memory for key-view delivery only.
4. Claim tokens are NEVER stored as plaintext. SHA-256 hash only.
5. Relay API keys are NEVER stored as plaintext. SHA-256 hash only. Shown once at creation.
6. Password reset tokens are NEVER stored as plaintext. SHA-256 hash only.
7. Relay link codes are NEVER stored as plaintext. SHA-256 hash only.
8. `relay_escrow_materials.materialEncrypted` is NEVER empty or plaintext. The column is `NOT NULL`.
