# Account Lifecycle

This document covers account export (data portability) and account deletion for Aegis Hosted and Relay subscribers.

## Data Export

### What is included

An export bundle contains all your data, encrypted with a passphrase you choose:

- Account profile (display name, email, timezone — no password hash)
- Subscription summary (plan name and status — no payment method details)
- All estate items (decrypted from server-side encryption, re-encrypted into the bundle)
- All contacts (decrypted, re-encrypted)
- Switch metadata (names, modes, statuses — not packet contents or keys)
- Release run metadata

### What is excluded

- Password hash
- Session tokens
- Stripe payment method details, customer IDs, or secret keys
- Provider credentials (S3 keys, Telegram bot tokens, Postmark API tokens)
- Packet encryption keys or packet contents
- Internal admin notes or operational metadata

### How to export

```http
POST /api/account/export
Cookie: aegis_session=<your-session>
X-CSRF-Token: <csrf-token>
Content-Type: application/json

{
  "password": "your-account-password",
  "passphrase": "your-export-bundle-passphrase"
}
```

- `password` is your current Aegis account password (required for reauthentication)
- `passphrase` is a passphrase you choose to encrypt the export bundle

**Response:** A JSON export bundle — save the full response body to a file.

### Export bundle format

```json
{
  "schemaVersion": "aegis-export-2026-05-01",
  "createdAt": "2026-05-14T12:00:00.000Z",
  "appVersion": "1.0.0-saas-alpha",
  "encryption": {
    "algorithm": "aes-256-gcm",
    "kdf": "argon2id",
    "salt": "<hex>",
    "iv": "<hex>",
    "authTag": "<hex>"
  },
  "payloadHash": "<sha256 hex>",
  "encryptedPayload": "<hex>"
}
```

The export is encrypted with AES-256-GCM. The key is derived from your passphrase using argon2id (64 MB memory cost, 3 iterations). **Without your passphrase, the bundle cannot be decrypted.**

### Passphrase warning

Store your export passphrase securely. If you lose it, the export file cannot be recovered — there is no server-side passphrase backup.

## Account Deletion

Account deletion permanently removes your personal data from Aegis servers. This action is irreversible.

### Recommended: download backup first

Before deleting your account, download an export of your data. Once deletion is confirmed, your estate items, contacts, and configuration are gone.

### Deletion process

Deletion requires two steps:

**Step 1: Request deletion**

```http
POST /api/account/request-deletion
Cookie: aegis_session=<your-session>
X-CSRF-Token: <csrf-token>
Content-Type: application/json

{
  "password": "your-account-password"
}
```

This reauthenticates you and sends a confirmation email to your registered address. The confirmation link expires in 15 minutes.

**Step 2: Confirm deletion via email link**

Click the link in the email, which calls:

```http
POST /api/account/confirm-deletion
Content-Type: application/json

{
  "token": "<token from email>"
}
```

The confirmation token is single-use — re-using it will return `400`.

### What happens on deletion

1. Active Stripe subscriptions are cancelled immediately
2. All active switches and release runs are stopped (unless a release is actively executing — those complete)
3. All user data is deleted:
   - Estate items
   - Contacts
   - Switches
   - Packets (metadata)
   - Release runs
   - Notification deliveries
   - Sessions
   - Relay connections
   - Encryption keys
4. Your user account row is **anonymized** (not deleted):
   - Email replaced with `deleted-{uuid}@deleted.invalid`
   - Display name cleared
   - Password hash cleared
   - All tokens cleared

The account row is retained in anonymized form for billing/legal purposes (Stripe customer records reference the user ID). No PII remains in the anonymized row.

### What data is retained

After deletion, the following non-PII records are retained for legal/audit purposes:
- Anonymized user row (no email, name, or password)
- Billing records (Stripe maintains its own records per Stripe's terms)
- Audit event log entries (no PII — only event types, timestamps, and anonymized user IDs)

### How to cancel subscription without deleting account

Use the Stripe customer portal to cancel your subscription without deleting your account:

```http
POST /api/billing/portal
Cookie: aegis_session=<your-session>
X-CSRF-Token: <csrf-token>
Content-Type: application/json

{
  "returnUrl": "https://app.aegisdms.life/billing"
}
```

Cancelling a subscription stops future charges but does not delete your account or data.

## Login after deletion

After account deletion is confirmed, login with the original email and password will return `401`. The email address is anonymized, so it cannot be used to register a new account under the same email until you re-register with your original address.
