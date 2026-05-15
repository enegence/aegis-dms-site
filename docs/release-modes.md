# Release Modes — Aegis DMS Site (SaaS)

Last updated: 2026-05-14
Status: Phase 5 baseline

---

## Overview

Aegis DMS Site manages three product surfaces, each with a different trust model and release mechanism.

---

## Modes

Valid `deploymentMode` values: `vault | dead_drop | relay_monitoring | relay_escrow | hosted`

> For Aegis Core (self-hosted), `hosted` is not available. For Aegis DMS Site, all five modes are handled by the SaaS backend.

---

## vault

**Who uses it:** Self-hosted Aegis Core users who link to SaaS for relay monitoring only.

**What it means:**
- Switch data, estate items, and contacts live entirely on the user's local server.
- Packets are stored locally.
- The SaaS only monitors heartbeats (in `relay_monitoring` or `relay_escrow`) or not at all.
- Release happens from the local server.

**Trust model:** User trusts only their own server. No third-party release capability.

**SaaS role:** None (monitoring only, if relay is configured).

---

## dead_drop

**Who uses it:** Self-hosted users with S3/R2 configured for packet storage.

**What it means:**
- Packets are uploaded to S3-compatible storage.
- Release requires the local server to serve the packet key, but the encrypted packet survives server loss.

**Trust model:** User trusts S3 to store ciphertext; user trusts their local server for key delivery.

**SaaS role:** Relay monitoring only (if configured).

---

## relay_monitoring

**Who uses it:** Self-hosted users who want a third-party watchdog.

**What it means:**
- OSS instance sends periodic heartbeats to Aegis Relay SaaS.
- If heartbeats stop, Relay sends offline alerts to the user's emergency contacts.
- Relay does NOT hold keys or release material.

**Trust model:** User trusts Relay to accurately report offline status. Relay cannot execute a release.

**SaaS stores:** Heartbeat timestamps, connection metadata (`relay_connections` table). No keys.

---

## relay_escrow

**Who uses it:** Self-hosted users who want maximum resilience without a local server requirement.

**What it means:**
- OSS instance links to Relay via authorization-code exchange.
- User uploads an encrypted release material to Relay.
- Relay monitors heartbeats.
- If offline threshold exceeded, Relay executes the release policy directly (notifies contacts, provides packet key).

**Trust model:** User trusts Aegis SaaS to hold encrypted material and execute the release policy correctly. Requires explicit trust acknowledgement via `trust_acknowledgements` table.

**SaaS stores:** Encrypted escrow material (`relay_escrow_materials`), release policy, escrow contact IDs.

**Alpha limitation:**
- SaaS uses server-side encryption. Relay CAN decrypt the material.
- No zero-knowledge escrow in v1.
- Trust acknowledgement is required and versioned.

---

## hosted

**Who uses it:** Non-technical users who don't want to run their own server.

**What it means:**
- Everything is managed by Aegis DMS Site: estate items, contacts, switches, packets, notifications, cascade, and key delivery.
- Users authenticate with email + password (no local server required).
- Aegis Hosted executes the full release flow when a switch triggers.

**Trust model:** User trusts Aegis DMS Site completely. Aegis holds all data and keys. There is no self-custody option in v1.

**SaaS stores:** All user data. All keys. All packets (in S3).

**Alpha limitation:**
- No zero-knowledge option. Aegis SaaS can decrypt all user data.
- This will be clearly disclosed in the onboarding flow and terms of service.

---

## Comparison Table

| Mode | Where data lives | Who holds keys | Release trigger | SaaS trust level |
|------|-----------------|---------------|-----------------|-----------------|
| vault | Local server | User | Local server | None |
| dead_drop | Local server + S3 | User (local) | Local server (key) | None |
| relay_monitoring | Local server | User | Local server | Watchdog only |
| relay_escrow | Local + Relay SaaS | Relay SaaS (encrypted) | Relay SaaS (if offline) | Holds encrypted material |
| hosted | Aegis SaaS | Aegis SaaS | Aegis SaaS | Full |

---

## Consent and Acknowledgement

Relay Escrow and Hosted modes require explicit user acknowledgement before enabling. The `trust_acknowledgements` table records:
- User ID
- Mode (`relay_escrow` or `hosted`)
- Version (terms/policy version)
- Accepted timestamp
- IP hash and user-agent hash (for audit)

This acknowledgement is required by the system before material can be uploaded or a hosted switch can be armed. A missing or stale acknowledgement blocks the operation.

---

## Notes on Deprecated Values

The following mode values are NOT valid:
- `local_only` — old name for vault
- `relay` — ambiguous old name, replaced by `relay_monitoring` or `relay_escrow`

Do not use these values in code, migrations, or UI copy.
