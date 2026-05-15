# DeadDrop API — Preview / Design Intent

**Status: NOT BUILT. Not planned for alpha or beta.**

This document describes the *intended future shape* of a public DeadDrop API product. Its purpose is to prevent architectural drift in OSS, Relay, and Hosted while they stabilize — not to commit to any external API compatibility.

Nothing in this document creates a guarantee of availability, timeline, or implementation.

---

## What Is the DeadDrop API

The DeadDrop API would be an external platform layer — a public REST API that allows third-party developers, automation tools, and advanced users to interact with DeadDrop's estate release mechanics programmatically.

It is distinct from the current internal APIs:
- `aegis/server` — OSS internal API (not public)
- `aegis-dms-site/server` — SaaS internal API (not public)

The DeadDrop API would be a separately managed API surface with its own versioning, rate limits, and developer docs.

---

## Planned Resource Model

Based on current architecture, the DeadDrop API would likely expose:

| Resource | Description |
|----------|-------------|
| `packets` | Build, upload, and retrieve encrypted estate packets |
| `release-runs` | Trigger, query, and cancel release lifecycle records |
| `heartbeats` | Send and query heartbeat records (for Relay Monitoring) |
| `claims` | Query and acknowledge contact claims |
| `webhooks` | Register and receive event notifications (trigger fired, claim acknowledged, etc.) |
| `storage-providers` | Configure S3-compatible storage backends |
| `notification-providers` | Configure SMTP and Telegram notification endpoints |

---

## Authentication Expectations

The DeadDrop API would use:
- **API keys** (not session cookies) — long-lived credentials for server-to-server use
- **Auth-code exchange** for browser-linked flows (matching the existing Relay linking pattern)
- API keys passed in the `Authorization: Bearer <key>` header — never in URL query strings

---

## What Stays Internal in Alpha/Beta

In alpha and beta, the following remain internal and are NOT exposed as a public API:

- User authentication (register, login, session management) — internal only
- Admin endpoints — internal only
- Billing and subscription management — internal only
- Field-level encryption key management — never externally exposed
- Audit log access — internal only

The public API surface, when it exists, will be narrowly scoped to protocol mechanics (packets, heartbeats, claims, release runs) and will have independent auth/rate limiting.

---

## Why This Document Exists

Without a forward-looking design reference, individual features risk "solving" API problems in ways that create accidental commitments or architectural dead ends. For example:

- If OSS Relay linking hardcodes a URL scheme, migrating to a real DeadDrop API endpoint becomes a breaking change
- If SaaS heartbeat routes return internal DB IDs directly, future API versioning becomes harder
- If contract schemas are not versioned, cross-repo compatibility breaks silently

This document serves as the "north star" to keep current designs API-compatible even before the API ships.

---

## Explicit Non-Commitments

- No external API compatibility is promised for alpha or beta
- The resource model above may change significantly before any public release
- No timeline is set for the DeadDrop API product
- No developer portal, SDK, or documentation will exist before the API ships
- Any internal API route (`/api/*` in either repo) may change without notice in alpha/beta

---

## When This Changes

This document will be revised when:
1. A decision is made to begin building the public API
2. The resource model is formally designed and reviewed
3. Auth and versioning strategies are finalized

Until then, treat this as design intent only.
