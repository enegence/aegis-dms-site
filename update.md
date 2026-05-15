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
- [x] Task 1–18: All complete

**OSS Phase 4: COMPLETE** (319 passing tests, branch `oss-phase-4`, plan: `2026-05-08-aegis-oss-phase4.md`)
- [x] Task 1: Setup state, guards, first-run routing (428 before setup, /api/setup/status, TOTP login)
- [x] Task 2: First-run setup wizard UI (6-step, deployment mode cards, TOTP login challenge)
- [x] Task 3: Interactive setup.sh script + .env.example
- [x] Task 4: Consolidated settings API (GET /api/settings + 6 PUT/POST endpoints)
- [x] Task 5: Settings UI tabbed layout (8 tabs: Profile, Deployment, Notifications, Storage, Relay, Security, Packets, Danger Zone)
- [x] Task 6: TOTP setup and disable flow (security routes + SecuritySettings inline wizard)
- [x] Task 7: Backup and restore guidance (docs/backups.md + DangerZone reminder)
- [x] Task 8: Docker and runtime hardening (healthcheck, bind mount, config validation)
- [x] Task 9: E2E test harness (Playwright, 4 spec files)
- [x] Task 10: Self-hosting documentation (self-hosting.md, troubleshooting.md, upgrading.md, README rewrite)
- [x] Task 11: Alpha readiness checklist + dashboard warning banner
- [x] Task 12: Final test and release candidate pass (TS build fix, completion notes)

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

### Phase 5: Production Hardening & Beta Readiness

**Phase 5: IN PROGRESS** (combined OSS + SaaS, plan: `2026-05-13-aegis-phase5-production-hardening.md`)
- [x] Task 1: Cross-repo security review baseline — threat model, security checklist, auth/session/CSRF verification, audit/log redaction checks, encrypted-field validation, TOTP recovery code/password change/rate-limit coverage (OSS: 343 tests, SaaS: 483 tests)
- [x] Task 2: Release-run idempotency and recovery hardening — state transition guards, one-active-run enforcement, atomic idempotency_keys table, worker restart recovery (OSS: 370 tests, SaaS: 506 tests)
- [x] Task 3: Notification delivery reliability — notification_deliveries table, retry/backoff policy, payload minimization, Postmark webhook ingestion (OSS: 413 tests, SaaS: 563 tests)
- [x] Task 4: Backup, export, restore, and deletion — OSS encrypted export/restore preview, SaaS account export, SaaS account deletion flow, backup/restore docs (OSS: 427 tests, SaaS: 576 tests)
- [x] Task 5: Observability, health, and operational readiness — structured redacted logs (pino redact config), detailed health endpoints (GET /api/health/details), worker heartbeat persistence (worker_heartbeats table), admin metrics with worker/alert state, getActiveAlerts() service (OSS: 440 tests, SaaS: 591 tests)
- [x] Task 6: SaaS support, billing, and admin hardening — admin 403 enforcement, full Stripe lifecycle (9 event types), idempotent webhook replay, UserDetail view, support runbook (SaaS: 610 tests)
- [x] Task 7: Legal, trust, and public safety pages — Terms/Privacy/Security/AUP/Disclaimers/Data Deletion pages, required acknowledgements, OSS trust-model references
- [x] Task 8: Beta E2E test matrix — expanded OSS/Hosted/Relay flows, real OSS↔SaaS integration coverage at nightly or release-gate, CI wiring
- [x] Task 9: Beta documentation and known limitations — beta-readiness docs, release checklist, known limitations, DeadDrop architecture doc, DeadDrop API preview doc
- [x] Task 10: OSS Relay linking, provider coverage, and accessibility polish — relay auth-code link-exchange endpoint, TOTP recovery codes (8 one-time codes, encrypted, constant-time verify), password change + session invalidation, @fastify/rate-limit on login/recovery/claim, S3/SMTP provider docs, a11y on Login/Setup/SecuritySettings/ClaimPortal/Register/AdminUsers (OSS: 504 tests, SaaS: 615 tests)
- [ ] Task 11: Production deployment, email templates, alerting, and release packaging — SaaS production deploy/DNS/rollback runbook, public support/contact flow, production-safe email templates, operator alerting, OSS beta release packaging ← WE ARE HERE

---

## Key Architecture Decisions

- **Two repos, not one.** OSS = SQLite/Docker/single-owner. SaaS = Postgres/Railway/multi-user. Shared concepts, independent implementations.
- **AGPL-3.0** for OSS (copyleft ensures contributions flow back). Proprietary for SaaS.
- **Field-level encryption** for all PII in the database. Category/title stay plaintext for filtering; everything sensitive is AES-256-GCM encrypted.
- **Dead Drop model** — encrypted packet uploaded to S3 while user is alive. Server doesn't need to be online at trigger time.
- **Release run constraint** — only one active release per owner at a time. No parallel cascades to same contacts.
- **Alpha framing** — the target is an alpha that proves the architecture and core workflows, not production. No Shamir secret sharing, no formal security audit, no HA deployment yet.
