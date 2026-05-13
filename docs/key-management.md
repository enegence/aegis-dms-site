# Key Management — Alpha

## Summary

This document describes the key management model for Aegis DMS Site (SaaS) in the alpha. Key management will evolve in future versions.

## Hosted Encryption

Aegis Hosted uses **server-side encryption with server-managed keys**. Field-level encryption uses AES-256-GCM. Keys are derived via HKDF from a master key held by the SaaS server.

- Sensitive estate and contact fields are encrypted before storage.
- Per-packet encryption keys are generated per-packet and stored encrypted in `encryption_keys`.
- The decrypted key material is never written to the database or logs.
- The server decrypts fields on retrieval for authenticated requests.

### What This Means for Trust

- Users must trust Aegis SaaS to protect the master encryption key.
- A server-side breach that includes both the database and the master key could expose plaintext data.
- **There is no zero-knowledge claim for Hosted v1.** The server can access plaintext.

## Relay Escrow Encryption

Relay Escrow material is client-provided and encrypted before transmission. The SaaS server holds both the encrypted material and the decryption capability (via the server master key).

- Material is encrypted AES-256-GCM before storage.
- The plaintext release material is never logged or written to the database unencrypted.
- The SaaS server CAN decrypt the material to execute a release.
- **There is no zero-knowledge claim for Relay Escrow v1.** Aegis SaaS can read the material.

## Alpha Limitations

| Feature | Status |
|---|---|
| Shamir Secret Sharing | Not implemented in alpha |
| Multi-party key management | Not implemented in alpha |
| Zero-knowledge hosted encryption | Not implemented in alpha |
| HSM key storage | Not implemented in alpha |
| Key rotation | Not implemented in alpha |
| Per-user master keys | Not implemented in alpha |

The alpha uses a single server-level master key (`AEGIS_ENCRYPTION_KEY`) for all users. This simplifies the implementation but concentrates trust in the server operator.

## Production Aspirations (Future)

Future versions may explore:
- Per-user derived keys (so users can change their password and rekey data)
- HSM-backed master key storage
- Client-side encryption for selected fields
- Shamir Secret Sharing for escrow material with multiple key holders

None of these are committed features for the alpha.

## Environment Variables

| Variable | Purpose |
|---|---|
| `AEGIS_ENCRYPTION_KEY` | 32+ byte master key used for AES-256-GCM field encryption |
| `AEGIS_SECRET_KEY` | 32+ byte key for cookie signing and CSRF token HMAC |

Both keys must be set in production. The server refuses to start if either contains `change-me` or is shorter than 32 characters.
