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

**SaaS Phase 1: COMPLETE** (25 passing tests, merged to main)
- [x] Task 1: Initialize project structure
- [x] Task 1B: DeadDrop contract package compatibility
- [x] Task 2: Docker Compose dev environment (PostgreSQL)
- [x] Task 3: Fastify server + health check
- [x] Task 4: Database schema + Drizzle setup
- [x] Task 5: Auth — password hashing + session management
- [x] Task 6: Email service (Postmark)
- [x] Task 7: Auth routes — register, login, email verify, password reset
- [x] Task 8: Stripe billing — checkout, webhook, subscription lifecycle
- [x] Task 9: Public pricing API
- [x] Task 10: React + Vite frontend scaffold
- [x] Task 11: Auth pages — register, login, reset password
- [x] Task 12: CSRF protection (Phase 1 complete)

### Phase 2: Core Domain Logic (SaaS — COMPLETE)

**SaaS Phase 2: COMPLETE** (175 passing tests)
- [x] Task 1: DB schema extensions
- [x] Task 2: Shared types + Zod API schemas
- [x] Task 3: Redacted audit service
- [x] Task 4: Field encryption domain helpers
- [x] Task 5: Relay connection management
- [x] Task 6: Relay heartbeat API
- [x] Task 7: Relay offline monitor worker
- [x] Task 8: Hosted estate item CRUD
- [x] Task 9: Hosted contact CRUD
- [x] Task 10: Hosted switch repository and state machine
- [x] Task 11: Hosted switch API routes
- [x] Task 12: Hosted dashboard API
- [x] Task 13: Billing portal route
- [x] Task 14: Frontend API client helpers
- [x] Task 15: App dashboard UI
- [x] Task 16: Hosted estate and contact UI
- [x] Task 17: Hosted switch UI
- [x] Task 18: Relay management UI
- [x] Task 19: Marketing landing and pricing pages
- [x] Task 20: Documentation
- [x] Task 21: End-to-end verification

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

**OSS Phase 2: COMPLETE** (178 passing tests, merged to master)
- [x] Task 1–18: All complete

**OSS Phase 3: COMPLETE** (292 passing tests, branch `oss-phase-3`, plan: `2026-05-08-aegis-oss-phase3.md`)
- [x] Task 1: Schema extensions (packets, contact_claims, release_runs, encryption_keys)
- [x] Task 2: Shared contracts + Zod schemas
- [x] Task 3: Packet crypto service (AES-256-GCM)
- [x] Task 4: Packet builder and repository
- [x] Task 5: Packet API routes
- [x] Task 6: S3-compatible storage provider
- [x] Task 7: Dead-drop sync service and worker integration
- [x] Task 8: Release run service (single active run constraint)
- [x] Task 9: Contact cascade service
- [x] Task 10: Public claim API routes
- [x] Task 11: Cascade integration in worker (auto-builds packet, starts cascade)
- [x] Task 12: Release status and audit log API routes
- [x] Task 13: Claim portal UI
- [x] Task 14: Release page and packet status UI
- [x] Task 15: Audit log UI
- [x] Task 16: Dashboard Phase 3 status cards
- [x] Task 17: Documentation (dead-drop, release flow, key management, threat model)
- [x] Task 18: End-to-end verification ← WE ARE HERE

**SaaS Phase 3: COMPLETE** (369 passing tests, plan: `2026-05-08-aegis-dms-site-phase3.md`)
- [x] Task 1: Schema verification and extension
- [x] Task 2: Shared types and contract usage
- [x] Task 3: Managed storage service
- [x] Task 4: Hosted packet crypto and builder
- [x] Task 5: Packet API routes
- [x] Task 6: Hosted notification dispatch
- [x] Task 7: Hosted release run service
- [x] Task 8: Hosted contact cascade
- [x] Task 9: Extend hosted worker
- [x] Task 10: Hosted public claim API
- [x] Task 11: Claim portal UI
- [x] Task 12: Relay escrow material model
- [x] Task 13: Relay-assisted cascade
- [x] Task 14: Admin API
- [x] Task 15: Admin dashboard UI
- [x] Task 16: Hosted release and packet UI
- [x] Task 17: Audit coverage and redaction tests
- [x] Task 18: Documentation updates
- [x] Task 19: End-to-end verification

### Phase 4: Polish + Deploy

**OSS:**
- First-run setup wizard
- setup.sh interactive script
- Settings page (notifications, storage, relay)
- Deployment mode selector
- TOTP setup
- End-to-end testing
- README + self-hosting docs

**SaaS Phase 4: COMPLETE** (449 server tests, 16 contract tests, 31 E2E tests configured)
- [x] Task 1: Finalize onboarding state and plan-aware routing
- [x] Task 2: Build hosted onboarding checklist
- [x] Task 3: Relay connection UI
- [x] Task 4: Relay API key rotation/revocation UI
- [x] Task 5: Billing management page (Stripe portal)
- [x] Task 6: Subscription status UX and gating
- [x] Task 7: Account and security settings polish
- [x] Task 8: Railway deployment config and production environment validation
- [x] Task 9: Production-safe CORS/cookies/CSRF/session settings
- [x] Task 10: Operational docs
- [x] Task 11: E2E tests (marketing → register → subscribe → onboarding → hosted app, Relay flow)
- [x] Task 12: Final alpha readiness checklist

---

## Key Architecture Decisions

- **Two repos, not one.** OSS = SQLite/Docker/single-owner. SaaS = Postgres/Railway/multi-user. Shared concepts, independent implementations.
- **AGPL-3.0** for OSS (copyleft ensures contributions flow back). Proprietary for SaaS.
- **Field-level encryption** for all PII in the database. Category/title stay plaintext for filtering; everything sensitive is AES-256-GCM encrypted.
- **Dead Drop model** — encrypted packet uploaded to S3 while user is alive. Server doesn't need to be online at trigger time.
- **Release run constraint** — only one active release per owner at a time. No parallel cascades to same contacts.
- **Alpha framing** — the target is an alpha that proves the architecture and core workflows, not production. No Shamir secret sharing, no formal security audit, no HA deployment yet.
