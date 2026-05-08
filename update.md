# Aegis DMS — Project Overview

## What We're Building

Four product surfaces, two repos:

1. **Aegis Core** (open-source, AGPL-3.0) — self-hosted Docker app for privacy-conscious users
2. **Aegis Relay** (paid SaaS feature) — cloud monitoring + optional release escrow for self-hosted users
3. **Aegis Hosted** (paid SaaS) — fully managed version for non-technical users
4. **DeadDrop API** (future) — infrastructure/platform product for third-party integrations

Both repos are TypeScript monorepos with Fastify + Drizzle + React + Vite + Tailwind.

---

## Repo 1: `aegis/` — Open-Source Self-Hosted App

**Database:** SQLite via better-sqlite3
**Auth:** Single-owner, Argon2id, DB sessions, optional TOTP
**Encryption:** AES-256-GCM field-level encryption for all PII at rest
**Deployment:** Docker Compose on user's own infra (Unraid, TrueNAS, VPS, Pi, etc.)

### Folder Structure

```
aegis/
├── packages/shared/       # Domain types shared between server and web
├── packages/contracts/    # DeadDrop protocol schemas (packet envelope, release run, etc.)
├── server/
│   ├── src/
│   │   ├── auth/          # Password hashing, sessions, TOTP, Fastify auth plugin
│   │   ├── db/            # Drizzle schema, connection, migrations
│   │   ├── routes/        # REST API endpoints (auth, estate, contacts, switches, packets, claims, etc.)
│   │   ├── services/      # Business logic (switch engine, cascade, packet builder, crypto, storage, notifications)
│   │   └── worker/        # Polling loop: evaluates switches, sends reminders, syncs packets
│   ├── tests/
│   └── drizzle/           # SQL migration files
├── web/
│   ├── src/
│   │   ├── pages/         # Setup, Login, Dashboard, Estate, Contacts, Trigger, Release, Settings, Claim portal
│   │   ├── components/    # UI kit (SketchCard, InkButton, etc.), layout, icons
│   │   ├── lib/           # API client, theme system (blueprint/cream/midnight)
│   │   └── hooks/
├── Dockerfile             # Multi-stage build (deps → web → server → production)
└── docker-compose.yml
```

### Deployment Modes

| Mode | Description | Resilience |
|------|-------------|------------|
| **Vault Mode** | Local planning/storage only. No guaranteed automated release unless external notification/reachability exists. | Low |
| **Dead Drop** | Local + encrypted packet synced to S3-compatible storage. Packet survives host loss. | Medium |
| **Relay Monitoring** | Local + SaaS monitors heartbeats + alerts. Local host may still be needed for final release. | Medium-High |
| **Relay Escrow** | Local + SaaS holds release material. Can execute release if host offline. Requires trust in SaaS. | High |
| **Hosted** | Fully managed SaaS. | Highest |

---

## Repo 2: `aegis-dms-site/` — Commercial SaaS Platform

**Database:** PostgreSQL (Railway)
**Auth:** Multi-user, Argon2id, email verification, password reset, Stripe billing
**Storage:** Managed R2/S3
**Notifications:** Managed Postmark + Telegram bot

### What It Provides

- **Aegis Hosted** — fully managed version for non-technical users (no Docker needed)
- **Aegis Relay** — cloud monitoring layer for self-hosted users (heartbeat tracking, offline detection, fallback notifications)
- **Claim Portal** — contact-facing flow for receiving and acknowledging released packets
- **Marketing Site** — landing page, pricing, docs
- **Admin Dashboard** — user list, metrics, subscription overview

### Folder Structure

```
aegis-dms-site/
├── packages/shared/
├── server/
│   ├── src/
│   │   ├── auth/          # Register, login, email verify, password reset, sessions
│   │   ├── db/            # PostgreSQL schema (multi-user, UUID PKs, jsonb)
│   │   ├── routes/        # Auth, billing, relay, estate, contacts, switches, claims, admin
│   │   ├── services/      # Same domain logic + Stripe, relay monitor, managed storage
│   │   └── worker/        # Hosted switches + relay monitoring loop
│   └── tests/
├── web/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── marketing/ # Landing, Pricing, About, Docs
│   │   │   ├── auth/      # Register, Login, ResetPassword
│   │   │   ├── app/       # Dashboard, Estate, Contacts, Trigger, Settings, Billing
│   │   │   ├── claim/     # Contact claim portal
│   │   │   └── admin/     # Admin dashboard
└── railway.toml
```

---

## Build Stages / Logical Sequencing

> **Note:** Phase labels are sequencing guidance, not fixed delivery estimates. Implementation should optimize for correctness, security, and coherent architecture over calendar targets.

### Phase 1: Foundation

**OSS: COMPLETE** (21 passing tests)
- [x] Project scaffold, Fastify server, health check
- [x] SQLite + Drizzle schema (10 tables) + migrations
- [x] Auth: owner setup, login, sessions
- [x] Estate item CRUD with field encryption
- [x] Contact CRUD with priority ordering
- [x] React/Vite/Tailwind frontend scaffold + login page
- [x] Docker multi-stage build
- [x] Static file serving with SPA fallback

**SaaS: IN PROGRESS**
- [x] Task 1: Initialize project structure
- [x] Task 1B: DeadDrop contract package compatibility
- [x] Task 2: Docker Compose dev environment (PostgreSQL)
- [x] Task 3: Fastify server + health check
- [x] Task 4: Database schema + Drizzle setup ← WE ARE HERE
- [ ] Task 5: Auth — password hashing + session management
- [ ] Task 6: Email service (Postmark)
- [ ] Task 7: Auth routes — register, login, email verify, password reset
- [ ] Task 8: Stripe billing — checkout, webhook, subscription lifecycle
- [ ] Task 9: Public pricing API
- [ ] Task 10: React + Vite frontend scaffold
- [ ] Task 11: Auth pages — register, login, reset password
- [ ] Task 12: CSRF protection

### Phase 2: Core Domain Logic

**OSS:**
- Switch state machine (trip + heartbeat modes)
- Switch CRUD API + arm/pause/cancel/check-in
- Notification system (SMTP + Telegram)
- Worker polling loop (evaluate switches, send reminders)
- Dashboard page with live countdown
- Trigger settings UI

**SaaS:**
- Relay API: accept heartbeats, detect offline, alert
- Hosted estate/contacts/switches CRUD (user-scoped)
- Marketing landing + pricing pages
- App dashboard for hosted users

### Phase 3: Encryption, Packets, Cascade

**OSS:**
- Packet builder: assemble estate items → encrypt → store
- S3-compatible storage: upload, verify, delete
- Dead drop sync in worker
- Contact cascade: notify → verify → accept → download → acknowledge
- Claim portal UI
- Escalation + timeout handling
- Audit log

**SaaS:**
- Managed storage (R2/S3)
- Hosted notification dispatch
- Hosted switch engine + cascade
- Relay-assisted cascade (offline fallback)
- Admin dashboard

### Phase 4: Polish + Deploy

**OSS:**
- First-run setup wizard
- setup.sh interactive script
- Settings page (notifications, storage, relay)
- Deployment mode selector
- TOTP setup
- End-to-end testing
- README + self-hosting docs

**SaaS:**
- Onboarding flow
- Relay connection UI
- Billing management (Stripe portal)
- Railway deployment
- End-to-end testing

---

## Key Architecture Decisions

- **Two repos, not one.** OSS = SQLite/Docker/single-owner. SaaS = Postgres/Railway/multi-user. Shared concepts, independent implementations.
- **AGPL-3.0** for OSS (copyleft ensures contributions flow back). Proprietary for SaaS.
- **Field-level encryption** for all PII in the database. Category/title stay plaintext for filtering; everything sensitive is AES-256-GCM encrypted.
- **Dead Drop model** — encrypted packet uploaded to S3 while user is alive. Server doesn't need to be online at trigger time.
- **Release run constraint** — only one active release per owner at a time. No parallel cascades to same contacts.
- **Alpha framing** — the target is an alpha that proves the architecture and core workflows, not production. No Shamir secret sharing, no formal security audit, no HA deployment yet.
