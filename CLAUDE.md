# Aegis DMS Site — Agent Bootstrap

## What This Is

Commercial SaaS platform for Aegis DMS (digital legacy release / dead man's switch).
Two repos exist: `aegis/` (OSS, SQLite, self-hosted) and this repo `aegis-dms-site/` (SaaS, PostgreSQL, Railway).

## Documentation Map

Read these before implementation work. Priority order:

| Priority | File | Purpose |
|----------|------|---------|
| 1 | `docs/superpowers/plans/2026-05-06-aegis-master-plan.md` | Architecture source of truth. Schemas, security baseline, integration points, key management model. |
| 2 | `docs/superpowers/plans/2026-05-08-aegis-dms-site-phase3.md` | SaaS Phase 3 plan (Tasks 1-10 done, 11-19 pending). **This is your execution target.** |
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
- **OSS Phase 2:** NOT STARTED — plan at `docs/superpowers/plans/2026-05-08-aegis-oss-phase2.md`
- **SaaS Phase 1:** COMPLETE (25 tests)
- **SaaS Phase 2:** COMPLETE (175 tests at completion)
- **SaaS Phase 3:** COMPLETE (369 tests at completion)
- **SaaS Phase 4:** COMPLETE (449 server tests, 16 contract tests, 31 E2E tests configured)

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

**Last completed:** OSS Phase 2 runtime bug fixes — all 5 reported bugs repaired and committed to `oss-phase-2` branch (178 tests pass, build clean). Ready to merge to master.
**Next up:** Merge `oss-phase-2` → master (manual review recommended), then choose: OSS Phase 3 (packets, S3, cascade, claim portal) OR SaaS Phase 5 (production hardening, Railway deploy, TOTP, legal pages).
**OSS status:** Phase 1 complete (21 tests). Phase 2 COMPLETE on `oss-phase-2` branch (178 tests) — all bugs fixed: wrong dashboard URL, wrong response shapes, missing purpose field, login CSRF, countdown logic, SwitchCard action date. Branch ready to merge. Phase 3 NOT STARTED.
**Blockers/notes:** Manual UI smoke test not performed (headless). RelayEscrowCard enable form is a UI skeleton — needs contact/packet selection dropdowns for production use. E2E tests require live dev server.
**Tests passing:** 449 SaaS server (41 test files) + 16 contracts + 31 E2E configured; OSS 178 server tests on oss-phase-2

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
- Do not use superpowers:using-git-worktrees
- TDD: write test first, verify red, implement, verify green, commit
- One task at a time, sequential order unless plan says otherwise
- Commit after each task passes tests
- Do not skip security, contracts, or schema correctness to move faster

## Pre-Commit Self-Review (required before every task commit)

**State machines:** Handlers for ordered lifecycles check the exact predecessor state, not "any valid state." Return current state unchanged if already past this step. Final-stage ops (e.g. acknowledge) must assert all prior required stages completed.

**Crypto:** Every encrypt call must have a stored, retrievable key path. Verify the decrypt flow works end-to-end before marking done. Encrypted-data-without-surviving-key = silent data loss.

**Plan fidelity:** Every named deliverable in a step must exist in code. If it can't be met, add `<!-- DEVIATION: [reason] -->` in plan AND code — never silently omit.

**Security non-negotiables:** Before marking a task done, verify each item in the plan's Security Non-Negotiables section is actually implemented — not deferred, not partial.

**Query semantics:** Eligibility queries (active/non-revoked) ≠ status queries (all rows). Write separate functions with purpose-encoded names. Never reuse.

**Test depth:** Tests must verify server-side invariants (query DB, audit log, schema), not just response shapes. "X is not stored" means assert it in the DB, not just check the response.

**Schema/contract alignment:** If code comments a deviation from the plan spec, add `<!-- DEVIATION: -->` in the plan doc too. Undocumented divergence is a hidden bug.

**Frontend API contract verification (UI tasks):** Before writing any fetch call, read the actual route handler to confirm: (1) the exact URL path including any prefix the plugin is registered under (check index.ts registration), (2) the exact response shape (bare array vs `{ field }` wrapper), (3) the exact request payload shape against the Zod schema. Never infer shapes from variable names or analogous routes.

**UX promises must be backed by API:** If the UI says "leave blank to keep existing" for a secret field, the API schema must allow optional/empty and the route must skip-on-empty. Verify both before writing the UI copy.

**Completion requires runtime correctness, not just build+test-pass:** Build success and server unit tests passing do not prove UI flows work. A task is not complete until the frontend can actually call its API endpoints with the correct payload and receive the expected response. If a manual smoke test cannot be run in the current environment, say so explicitly — do not mark tasks done.

**Cross-service gating:** When service A creates a record consumed by service B or a worker, read B's entry condition before finishing A. If B gates on a field (e.g. `activePacketId`, `status`, a FK), A must populate that field or the record is silently orphaned. Unit tests for A pass; B skips the record. Trace the full path: create → consume → assert progress.

**Audit emitters vs. registry:** A string list of event type names in a test or constant is NOT proof those events fire. For every audit event type in the spec, grep for an actual `writeAuditEvent(... eventType: 'the-event' ...)` call. Missing = unimplemented. Tests that only check the string registry catch typos, not missing emitters.

**Docs accuracy:** After implementing a route or service, re-read any doc that describes its behavior (status codes, what is stored, what is executed, error responses). Docs that overstate or misstate behavior are bugs — a doc saying "returns 410" when the code returns 404, or "executes the release policy" when it only creates a DB row, will mislead future implementers. Fix the doc or the code, not just one of them.
