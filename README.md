# Aegis DMS Site

Commercial SaaS platform for Aegis DMS — digital legacy release and dead man's switch infrastructure.

This repo provides two paid product surfaces:

- **Aegis Relay** — cloud monitoring for self-hosted Aegis Core users (heartbeat tracking, offline detection, alert emails)
- **Aegis Hosted** — fully managed estate/contact/switch management for non-technical users (no Docker required)

See the companion OSS repo (`aegis/`) for Aegis Core — the self-hosted AGPL-3.0 app.

---

## Stack

TypeScript, Fastify, Drizzle ORM, PostgreSQL, React 18, Vite, Tailwind CSS, Vitest, Argon2, Stripe, Postmark, Docker.

---

## Running Locally

```bash
docker compose up -d        # start PostgreSQL
cd server && npm run dev     # start API server (port 3000)
cd web && npm run dev        # start frontend dev server (port 5173)
```

Run tests:

```bash
cd server && npm test
```

---

## Phase Status

### Phase 1: Foundation (complete — 25 tests)

- Project scaffold, Fastify server, health check
- PostgreSQL + Drizzle schema + migrations
- Auth: register, login, email verification, password reset, session management
- CSRF protection
- Stripe billing: checkout, webhook, subscription lifecycle
- Public pricing API
- Postmark email service
- React + Vite + Tailwind frontend scaffold
- Auth pages: register, login, reset password

### Phase 2: Core Domain Logic (complete — 175 tests)

- Relay heartbeat API (`POST /api/relay/heartbeat`, `GET /api/relay/status`)
- Relay connection management (create, list, rotate key, revoke, delete)
- Relay offline monitor worker (missed heartbeat detection, alert email dispatch)
- Hosted estate item CRUD with AES-256-GCM field encryption
- Hosted contact CRUD with field encryption and priority ordering
- Hosted switch state machine (trip + heartbeat modes, arm/pause/cancel/check-in)
- Switch readiness checks
- Hosted dashboard API (`GET /api/dashboard`)
- Billing portal route (`POST /api/billing/portal`)
- Frontend: dashboard, estate, contacts, trigger, relay, billing, marketing, pricing pages
- Audit log with redacted PII metadata

### Phase 3: Packets and Cascade (upcoming)

- Managed packet generation and R2/S3 storage
- Hosted contact cascade (notify → verify → accept → download → acknowledge)
- Claim portal release flow
- Relay Escrow release execution
- Admin analytics dashboard

---

## Documentation

- [`docs/relay.md`](docs/relay.md) — Relay Monitoring: heartbeat API, API key handling, offline detection, alert behavior
- [`docs/hosted.md`](docs/hosted.md) — Hosted: data management, switch modes, Phase 2 limitations, trust model
- [`docs/billing.md`](docs/billing.md) — Plans, Stripe integration, billing portal, alpha pricing
- [`docs/security.md`](docs/security.md) — Field encryption, auth, API keys, audit log, alpha limitations
- [`docs/superpowers/plans/`](docs/superpowers/plans/) — Implementation plans (master plan, Phase 1, Phase 2)

---

## Architecture Notes

- Two repos: `aegis/` (OSS, SQLite, single-owner) and `aegis-dms-site/` (SaaS, PostgreSQL, multi-user).
- Field-level AES-256-GCM encryption for all PII. Category/title stay plaintext for filtering.
- AGPL-3.0 for OSS; proprietary for SaaS.
- Alpha: no formal security audit, no zero-knowledge guarantees, no HA deployment, no Shamir secret sharing.
- Prices are placeholders. Do not treat displayed amounts as final.
