# Security Model

## Field Encryption

All PII fields are encrypted at rest using AES-256-GCM before storage. The encryption approach:

- **Algorithm:** AES-256-GCM (authenticated encryption — provides both confidentiality and integrity)
- **Key derivation:** HKDF from the master key (`AEGIS_ENCRYPTION_KEY`) with context string `aegis-field-encryption-v1`
- **Per-field IV:** A random 12-byte IV is generated for each encryption operation
- **Auth tag:** The 16-byte GCM auth tag is stored alongside the ciphertext
- **Storage format:** `iv:ciphertext:tag` (base64-encoded components)

Decryption fails with an error if the auth tag does not match, preventing silent tampering.

## Encrypted Fields

The following fields are encrypted before storage. Plaintext versions of these fields are never written to the database.

**Estate items:**

| API field | Encrypted DB column |
|---|---|
| `institutionName` | `institutionNameEncrypted` |
| `accountType` | `accountTypeEncrypted` |
| `referenceHint` | `referenceHintEncrypted` |
| `assetDescription` | `assetDescriptionEncrypted` |
| `locationNotes` | `locationNotesEncrypted` |
| `executorNotes` | `executorNotesEncrypted` |

**Contacts:**

| API field | Encrypted DB column |
|---|---|
| `fullName` | `fullNameEncrypted` |
| `relationship` | `relationshipEncrypted` |
| `email` | `emailEncrypted` |
| `phone` | `phoneEncrypted` |
| `telegramHandle` | `telegramHandleEncrypted` |
| `backupNotes` | `backupNotesEncrypted` |

## Plaintext Fields

The following fields are intentionally stored as plaintext because they are required for filtering, display, or ordering:

- Estate item `category`
- Estate item `title`

Do not add plaintext storage for any other estate or contact fields.

## Authentication

- **Password hashing:** Argon2id. No MD5, SHA-1, bcrypt, or PBKDF2 for passwords.
- **Sessions:** HttpOnly cookies, `Secure` flag in production, `SameSite=Lax` or `Strict`. Session IDs are random and not derived from user data.
- **Cookie security:** The server refuses to start in production if `SESSION_SECRET` is less than 32 characters or contains the string `change-me`.
- **CSRF:** All state-changing browser requests require an `X-CSRF-Token` header containing a signed, session-bound CSRF token. Tokens are fetched from `GET /api/csrf`. API key routes (Relay heartbeat/status) are exempt from browser CSRF, but require valid API key auth instead.
- **Rate limiting:** Login, register, password reset, and claim endpoints are rate-limited.
- **Email verification:** Required before arming hosted switches.

## API Keys

Relay API keys:

- Generated with a `rlk_` prefix and high entropy (crypto-random).
- Shown to the user exactly once: at creation and after rotation.
- Stored only as `SHA-256(raw_key)` in the database. The raw key is never persisted.
- Never logged. Never included in audit event metadata.
- Rotation immediately invalidates the previous key.
- Revoked connections reject all subsequent heartbeat/status requests.

## Audit Log

All domain operations write to `audit_events`. The audit log is designed to be safe for review without exposing PII.

Audit metadata is sanitized before insert. The following keys are redacted or rejected if present in metadata:

```
email, phone, name, institution, account, password, secret, token,
apiKey, keyMaterial, plaintext, executorNotes, stripeSecret
```

Audit metadata never contains:
- Contact names, emails, phones, or Telegram handles
- Estate institution names, account numbers, or reference hints
- API keys or key material
- Plaintext passwords or session tokens

## CORS

CORS is configured with an explicit allowlist of allowed origins. Wildcard (`*`) with credentials is not permitted.

## Secrets Validation at Startup

The server validates required secrets at startup in production mode. It refuses to start if:

- `AEGIS_ENCRYPTION_KEY` is less than 32 characters or contains `change-me`
- `SESSION_SECRET` is less than 32 characters or contains `change-me`
- `STRIPE_SECRET_KEY` is missing in production

## Alpha Limitations

The following are known limitations of the current alpha implementation:

- **No formal security audit.** The codebase has not been reviewed by an external security firm.
- **No Shamir Secret Sharing.** Key splitting across multiple parties is not implemented. The server holds the single master encryption key.
- **No zero-knowledge guarantees.** Hosted v1 uses server-side encryption. Aegis SaaS can decrypt user data.
- **No HA deployment.** The alpha runs on a single Railway instance with no redundancy.
- **No HSM or key management service.** The encryption key is an environment variable.
- **Alpha pricing only.** No production billing contracts in place.

These limitations are appropriate for an alpha that validates the architecture and core workflows. They must be addressed before any production or regulated-data deployment.
