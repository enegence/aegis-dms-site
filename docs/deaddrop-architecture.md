# DeadDrop Architecture

## Overview

"DeadDrop" is the protocol and engine layer that powers Aegis's estate release mechanics. It is not a single product — it is the shared conceptual framework across Aegis Core, Aegis Relay, and Aegis Hosted.

---

## Component Boundaries

```
┌─────────────────────────────────────────────────────────┐
│                   Aegis Products                        │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Aegis Core │  │  Aegis Relay │  │ Aegis Hosted  │  │
│  │ (self-hosted│  │  (SaaS layer)│  │  (fully SaaS) │  │
│  │  AGPL-3.0)  │  │              │  │               │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                │                   │          │
│         └────────────────┴───────────────────┘          │
│                          │                              │
│              ┌───────────▼────────────┐                 │
│              │   DeadDrop Engine      │                 │
│              │ (internal services)    │                 │
│              │ - Switch state machine │                 │
│              │ - Release run mgmt     │                 │
│              │ - Contact cascade      │                 │
│              │ - Packet crypto        │                 │
│              │ - Notification dispatch│                 │
│              └───────────┬────────────┘                 │
│                          │                              │
│              ┌───────────▼────────────┐                 │
│              │ DeadDrop Protocol      │                 │
│              │  Contracts             │                 │
│              │ (packages/contracts/)  │                 │
│              │ - Packet envelope      │                 │
│              │ - Release run schema   │                 │
│              │ - Claim acknowledgement│                 │
│              └───────────┬────────────┘                 │
│                          │                              │
│              ┌───────────▼────────────┐                 │
│              │ Future: DeadDrop API   │                 │
│              │ (external platform)    │                 │
│              │ — NOT IN ALPHA/BETA —  │                 │
│              └────────────────────────┘                 │
└─────────────────────────────────────────────────────────┘
```

---

## Terminology

### DeadDrop Protocol

The shared contract types that define how estate data is packaged, encrypted, and released. Located in `packages/contracts/` in both `aegis/` (OSS) and `aegis-dms-site/` (SaaS).

Key schemas:
- **Packet envelope** — encrypted estate content with metadata header
- **Release run** — a triggered release lifecycle record
- **Contact claim** — a contact's acknowledgement of receiving a packet
- **Trust acknowledgement** — a versioned record of a user accepting a trust model

These schemas are versioned and must remain compatible between OSS and SaaS.

### DeadDrop Engine

The internal service layer that implements release mechanics. Not a separate deployable — it is the business logic inside Aegis Core, Relay, and Hosted.

Engine responsibilities:
- Switch state machine (armed → triggered → completed/revoked)
- Release run lifecycle (start → contact cascade → claim wait → complete)
- One-active-run-per-user enforcement
- Packet crypto (encrypt at build time, decrypt at claim time)
- Notification dispatch with retry and delivery tracking
- Worker polling loop (heartbeat evaluation, offline detection)

### DeadDrop API (Future)

A planned external platform product that would expose DeadDrop capabilities via a public REST/webhook API for third-party integrations. **This does not exist yet and is not planned for alpha or beta.** See `docs/deaddrop-api-preview.md`.

---

## Deployment Modes

Each mode determines how much trust flows to external infrastructure:

| Mode | Where data lives | Who releases | Trust required |
|------|-----------------|-------------|---------------|
| **Vault** | User's own host | User's host must be online | None (self only) |
| **Dead Drop** | User's host + S3 packet | User's host must be reachable | S3 provider |
| **Relay Monitoring** | User's host | User's host must be reachable | Aegis detects offline |
| **Relay Escrow** | User's host + Aegis holds material | Aegis can release if host offline | Aegis SaaS |
| **Hosted** | Aegis fully manages | Aegis executes release | Aegis SaaS (full) |

---

## Packet Lifecycle

```
Build time (user alive):
  1. User configures estate items + contacts + switch
  2. PacketBuilder encrypts estate content (AES-256-GCM, field-level)
  3. Encrypted packet stored in managed storage (S3/R2)
  4. Packet metadata stored in DB (no plaintext content in DB)

Trigger time (switch trips):
  5. Worker detects missed heartbeat (or manual trigger)
  6. Release run created (idempotent — one active run per user)
  7. Contact cascade starts — notifications sent per priority order
  8. Each contact receives a claim URL with a one-time token

Claim time (contact claims):
  9. Contact opens claim URL, verifies identity (PIN or link)
  10. Contact downloads or views estate content
  11. Contact acknowledges receipt
  12. Release run progresses through cascade stages
  13. Release run completes when all contacts acknowledged or timeout
```

---

## Contract Compatibility

OSS and SaaS share the `packages/contracts/` schema types. Any change to contract shapes must be:
1. Versioned (bump the schema version field)
2. Backward compatible or gated behind a version check
3. Reflected in both repos before releasing

Contract violations are treated as bugs, not deviations.

---

## What Is Not DeadDrop

- **The marketing site** — `/pricing`, `/terms`, `/docs`, etc. are product surfaces, not protocol components.
- **The admin dashboard** — operational tooling, not protocol.
- **Stripe billing** — payment infrastructure, not estate protocol.
- **Postmark** — delivery infrastructure, not protocol (the protocol only defines that notifications must be sent; it doesn't mandate the provider).
