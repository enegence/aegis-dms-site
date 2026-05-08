# Aegis DMS Site — Agent Bootstrap

## What This Is

Commercial SaaS platform for Aegis DMS (digital legacy release / dead man's switch).
Two repos exist: `aegis/` (OSS, SQLite, self-hosted) and this repo `aegis-dms-site/` (SaaS, PostgreSQL, Railway).

## Documentation Map

Read these before implementation work. Priority order:

| Priority | File | Purpose |
|----------|------|---------|
| 1 | `docs/superpowers/plans/2026-05-06-aegis-master-plan.md` | Architecture source of truth. Schemas, security baseline, integration points, key management model. |
| 2 | `docs/superpowers/plans/2026-05-06-aegis-saas-phase1.md` | SaaS implementation plan. Task-by-task TDD steps with exact code. **This is your execution target.** |
| 3 | `update.md` | Current progress overview. Update the `CURRENT TASK` marker as you complete work. |
| 4 | `docs/superpowers/plans/2026-05-06-aegis-oss-phase1.md` | OSS Phase 1 plan (COMPLETE). Reference for contract compatibility and shared patterns. |
| 5 | `project-aegis-rebuilt-prd.md` | Original PRD. Read if you need product-level "why" context. |
| 6 | `aegis-questions.md` | Pre-planning Q&A. Read if an architecture decision seems unclear. |

Historical/applied patch docs (already baked into plans, read only if referenced):
- `aegis-product-architecture-patch-directive.md`
- `final-patch.md`
- `aegis-deaddrop.md`

## Current State

- **OSS Phase 1:** COMPLETE (separate `aegis/` repo, 21 passing tests)
- **SaaS Phase 1:** NOT STARTED — begin at Task 1

## Completion Tracking Protocol

Task progress is tracked in TWO places. Keep both in sync:

### 1. Plan docs (task-level tracking)

The plan files use `- [ ]` checkbox syntax. As you complete each step:
- Change `- [ ]` to `- [x]` for the completed step
- Do this IMMEDIATELY after the step passes (not batched at end)
- If a step needs modification from what the plan specifies, complete it and add a note: `<!-- DEVIATION: [reason] -->`

### 2. update.md (phase-level tracking)

After completing each numbered Task (not each step), update `update.md`:
- Move the `← WE ARE HERE` marker to reflect current position
- If a phase section's tasks are all done, mark it complete

### Session Handoff

At the END of every session (or when context is getting long), update this section:

**Last completed:** Task ___
**Next up:** Task ___
**Blockers/notes:** ___
**Tests passing:** ___

## Non-Negotiable Constraints

These are security and architecture invariants. Violating any of these is a bug.

### Encryption
- All PII fields encrypted at rest using `*Encrypted` column naming convention
- Fields that MUST be encrypted: institution name, account type, reference hint, asset description, location notes, executor notes, contact full name, relationship, email, phone, telegram handle, backup notes
- Category and title stay plaintext (needed for filtering/display)
- Audit logs NEVER contain plaintext PII (no names, emails, phones, account numbers)

### Auth & Security
- CSRF protection is Phase 1 (GET /api/csrf, X-CSRF-Token on all state-changing requests)
- HttpOnly cookies, Secure in production, SameSite=Lax or Strict
- Explicit CORS allowlist (no wildcard with credentials)
- Rate limiting on login, register, reset, claim endpoints
- Server refuses to start if secrets contain "change-me" or are < 32 chars in production
- Password reset tokens stored as SHA-256 hash, single-use, 15-minute expiry
- API keys NEVER passed in URL query strings (use auth code exchange for Relay linking)

### Schema
- `release_runs` table is first-class (one active release run per user at a time, no parallel cascades)
- `trust_acknowledgements` table backs Relay Escrow and Hosted consent (versioned, auditable)
- `packages/contracts/` exists in Phase 1 (must match OSS contract shapes, use versioned zod schemas)
- Deployment modes: `vault | dead_drop | relay_monitoring | relay_escrow | hosted`
  - Do NOT use old values: `local_only`, `relay`

### Key Management (Alpha)
- No Shamir Secret Sharing in alpha
- No "zero knowledge" claims unless fully designed and proven
- Relay Monitoring != Relay Escrow (monitoring tracks heartbeats; escrow holds release material)
- Hosted uses server-side encryption with server-managed release for v1

### Pricing
- All prices are placeholders in alpha
- `PricingPlan.price` is `number | null` with optional `pricingUrl`
- If pricing unavailable, return `price: null` + link to pricing page
- Do NOT hardcode final product pricing

## Product Surfaces

```
Aegis Core       — Open-source, self-hosted app (AGPL-3.0)
Aegis Relay      — Paid SaaS feature for self-hosted users
Aegis Hosted     — Fully managed SaaS for non-technical users
DeadDrop API     — Future infrastructure/API product (design for, don't build yet)
```

DeadDrop API is NOT a replacement for the other three. It is the future platform layer.

## Repo & Naming Conventions

- This repo: `aegis-dms-site/`
- OSS repo: `aegis/`
- Do NOT use `aegis-saas/` (old name)
- Product names: Aegis Core, Aegis Relay, Aegis Hosted, DeadDrop API, Aegis DMS Site

## Tech Stack

TypeScript, Fastify, Drizzle ORM, PostgreSQL, React 18, Vite, Tailwind CSS, Vitest, Argon2, Stripe, Postmark, Docker.

## Execution Style

- Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` skill
- TDD: write test first, verify red, implement, verify green, commit
- One task at a time, sequential order unless plan says otherwise
- Commit after each task passes tests
- Do not skip security, contracts, or schema correctness to move faster
