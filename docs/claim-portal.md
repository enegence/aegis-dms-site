# Claim Portal

## Overview

The claim portal is the contact-facing flow for receiving a released packet. It requires no account or login — contacts follow a one-time link.

The claim portal is public (no browser auth required). However, each step has server-side state gates to prevent out-of-order access.

## Flow

```
Contact receives notification (email or Telegram)
      ↓
GET /claim/:token  →  Landing page
      ↓
POST /claim/:token/open  →  Mark claim opened
      ↓
POST /claim/:token/verify  →  Optional PIN verification
      ↓
POST /claim/:token/accept  →  Explicit acceptance
      ↓
GET /claim/:token/packet  →  Download encrypted packet
POST /claim/:token/key-view  →  View decryption key (logged)
      ↓
POST /claim/:token/acknowledge  →  Final confirmation
```

## State Machine

Each step asserts the prior step was completed before allowing progression:

| Step | Required prior state |
|---|---|
| open | none |
| verify | opened |
| accept | opened (verified if PIN configured) |
| packet download | accepted |
| key-view | accepted |
| acknowledge | packet downloaded AND key viewed |

An attempt to skip steps returns a 409 or 422 error.

## Token Handling

- Claim tokens are generated with high entropy (`randomBytes(48).toString('hex')`).
- The raw token is included in the notification link. It is never stored server-side.
- Only `SHA-256(token)` is stored in `contact_claims.claimTokenHash`.
- Tokens are single-use per claim. Acknowledging a claim marks it complete.
- Tokens expire at `expiresAt` (default: 72 hours from notification send).

## PIN Verification

If the owning user configured a PIN for a contact, the claim portal prompts for it at the verify step. The PIN hash (`claimPinHash`) is stored on the `contacts` record. The claim portal verifies the hash.

PINs are optional. If no PIN is configured, the verify step is skipped.

## Packet Download

The encrypted packet is streamed from managed R2/S3 storage directly to the contact's browser. The server acts as a proxy — it fetches from storage and streams the bytes. The raw packet URL is never exposed to the client.

The download is logged as a `packet_downloaded` audit event (no PII in metadata).

## Release Material View

After downloading the packet, the contact may view the decryption key via the `key-view` step. The server decrypts the packet key from managed storage and returns it. This is logged as a `release_material_viewed` audit event.

The decryption key is shown once in the claim portal UI. It is not re-requestable.

## Escalation

If a contact does not complete the claim within the configured `confirmationWindowHours`, the hosted worker escalates to the next priority contact. Escalation is logged as `contact_escalated`.

If all contacts are exhausted without acknowledgement, the release run transitions to `failed` and is logged as `cascade_failed`.

## Security Notes

- The claim portal is public but gated by the token hash lookup.
- CSRF is not required on claim endpoints (no browser session; token is the authenticator).
- Rate limiting applies to claim endpoints to prevent token enumeration.
- Expired or unknown claims return a generic 404 response to prevent token enumeration.
