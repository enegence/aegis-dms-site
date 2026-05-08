# Aegis DMS — Pre-Planning Q&A

Questions asked during the architecture planning session to align on all major decisions before writing implementation plans.

---

## 1. REPO STRUCTURE & CODE SHARING

PRD says `aegis/apps/web/` + `aegis/apps/api/`. But you're building three products:

- **Q1a:** One mono-repo for everything (OSS core + Relay + SaaS)? Or separate repos — public OSS repo + private commercial repo that imports the core?
- **Q1b:** If mono-repo, are you using something like Turborepo/Nx, or keeping it simple with just directory structure?
- **Q1c:** Does the Relay backend share code with the core FastAPI backend, or is it a separate service entirely?

**Answers:** Separate repos. Public OSS repo (AGPL-3.0) + private SaaS repo (proprietary). No mono-repo. Relay is part of SaaS repo, not a separate service.

---

## 2. DATABASE SPLIT

PRD says SQLite for self-hosted. SaaS can't run SQLite at scale.

- **Q2a:** Postgres for SaaS from day one? Or SQLite everywhere and migrate later?
- **Q2b:** If both, do you want an abstraction layer (SQLAlchemy works for both), or separate implementations?
- **Q2c:** SQLCipher vs application-level field encryption — which direction? SQLCipher adds binary dependency complexity for self-hosters on ARM (Raspberry Pi).

**Answers:** Postgres for SaaS from day one. Drizzle ORM abstracts both SQLite and PostgreSQL. Application-level AES-256-GCM field encryption (not SQLCipher) — avoids ARM binary issues.

---

## 3. "LAY PERSON" SETUP

You said "handful of commands." Need to pin this down.

- **Q3a:** What's the absolute minimum viable self-hosted setup? Can someone run Aegis local-only with ZERO external services (no S3, no SMTP, no Telegram)? If so, what does it actually do — just store data locally with no notification capability?
- **Q3b:** Are you targeting a one-liner like `curl -fsSL aegis.sh | sh` that generates `.env` and runs `docker compose up`? Or just a good README?
- **Q3c:** Unraid Community Apps template — is that a day-one goal or post-launch?
- **Q3d:** Should the first-run setup wizard handle ALL configuration (SMTP, S3, etc.) from the web UI, so users never touch `.env` directly? That changes how config works significantly.

**Answers:** Yes, local-only with zero external services must work (stores data, manages switches, but no notification delivery). Setup.sh script that prompts for config, generates .env, runs docker compose. Unraid template post-launch. First-run web wizard handles remaining config after .env basics are set.

---

## 4. FRONTEND DIRECTION

Current prototype = vanilla React + Babel CDN. PRD says Next.js.

- **Q4a:** Confirm: the actual product will be Next.js, and this prototype is just for design exploration? Or do you want to keep it simple and ship as a single-page React app (Vite)?
- **Q4b:** Next.js adds SSR complexity in Docker. A Vite SPA behind the FastAPI backend is simpler for self-hosters (single container possible). Strong preference?
- **Q4c:** The sketchy/hand-drawn stick-figure aesthetic — is this for BOTH the marketing site AND the actual app dashboard? Or does the app get a cleaner UI while marketing keeps the personality?

**Answers:** React + Vite SPA for both repos. OSS = SPA served by Fastify. SaaS = Vite SPA for app pages (Next.js only if SEO critical for marketing, but not required for v1). Sketchy aesthetic for both marketing and app — consistent brand.

---

## 5. AUTH ARCHITECTURE

OSS = single admin passphrase. SaaS = full multi-tenant user system.

- **Q5a:** SaaS auth — build custom, or use something like Clerk/Auth.js/Supabase Auth/Lucia?
- **Q5b:** Does the OSS version ever support multiple users (e.g., household with two people each managing their own switch)? Or strictly single-owner?
- **Q5c:** For the "upgrade from local to Relay" flow — does the local app call out to your SaaS to create an account? Or does the user sign up separately and link via API key?

**Answers:** Custom-built auth (Argon2 + DB sessions + TOTP). No Clerk — save costs, full control. OSS = single-owner for v1. Upgrade flow: user clicks "Connect to Relay" in OSS → opens SaaS auth → gets API key → local app stores key and starts sending heartbeats.

---

## 6. BILLING & COMMERCIAL

- **Q6a:** Stripe? Any other billing provider considered?
- **Q6b:** $4/mo Relay, $9/mo Hosted — are these final? Annual discount?
- **Q6c:** Free tier for Relay (limited features) or straight free-trial-to-paid?
- **Q6d:** What's the Helper Pack pricing model — included in Hosted, add-on for Relay, one-time purchase?

**Answers:** Stripe only. Prices tentative but in that range. Free trial approach TBD. Helper Pack = cheaper subscription add-on (not one-time) since Relay provides ongoing monitoring that costs money to run.

---

## 7. LICENSING

This one matters a lot for commercial strategy.

- **Q7a:** AGPL means any hosted competitor must open-source their changes. MIT means anyone can fork and compete. BSL (like HashiCorp/Sentry) gives you time-delayed open source. Which direction?
- **Q7b:** If AGPL for core — does the Relay/SaaS code stay proprietary? Or do you want everything open?

**Answers:** AGPL-3.0 for OSS core. SaaS/Relay stays proprietary. Protects commercial offering while allowing self-hosting.

---

## 8. DEPLOYMENT & INFRASTRUCTURE

- **Q8a:** Railway — single service or multiple (API + web + worker + Postgres + Redis)?
- **Q8b:** Do you need Redis/Celery for the SaaS worker, or is the same polling-loop-from-DB pattern from the PRD sufficient at SaaS scale?
- **Q8c:** Any interest in Coolify/self-hosted PaaS instead of Railway to reduce costs?

**Answers:** Railway with multiple services in one project (web, api, worker, postgres). No Redis — DB polling loop (30-60s) sufficient for SaaS scale at launch. Staying with Railway (hobby plan, existing familiarity).

---

## 9. NOTIFICATION PROVIDERS (SaaS)

- **Q9a:** SaaS customers won't configure their own SMTP. Which managed email provider — Resend? SendGrid? Postmark? SES?
- **Q9b:** SMS — Twilio for SaaS too? Or something cheaper like Vonage/MessageBird?
- **Q9c:** The Telegram bot for SaaS — one shared bot, or per-customer bots?

**Answers:** Postmark for email. SMS deferred to post-launch. Single shared Telegram bot (@AegisDMSBot) for SaaS; user-configured bot for OSS.

---

## 10. ENCRYPTION & KEY MANAGEMENT (SaaS)

The PRD flags this as "requires further design."

- **Q10a:** For hosted SaaS — server-side encryption where Aegis holds keys? Or client-side encryption where user holds a master passphrase (like 1Password model)?
- **Q10b:** If server-side, are you comfortable with the trust/liability of holding estate data encryption keys?
- **Q10c:** Key escrow for Relay mode — have you thought about using a split-secret approach (Shamir's Secret Sharing), or is that overengineering for v1?

**Answers:** Server-side encryption for SaaS v1 (estate metadata is not credentials — acceptable risk, needed for Helper Pack generation). Shamir's Secret Sharing (2-of-3) for Relay mode key splitting — Relay alone cannot decrypt. Client-side encryption could be a v2 premium feature.

---

## 11. PRIORITY & SEQUENCING

- **Q11a:** What ships first — OSS core, or marketing site? Or both together?
- **Q11b:** Is the Relay MVP gated on having the full OSS core done, or can they develop in parallel?
- **Q11c:** Target timeline? Weeks? Months? Is there a launch event or community you're targeting?

**Answers:** Parallel development — both repos simultaneously. ~1 month target for hosted/relay basic functionality + OSS full release on GitHub. No specific launch event.

---

## 12. DESIGN EDGE CASES

- **Q12a:** What happens if a user sets up Aegis, stores critical estate data, then stops paying for Relay/Hosted? Data hostage problem. Policy?
- **Q12b:** Multi-switch — can one user have both a Heartbeat AND a Trip running simultaneously? PRD implies yes but doesn't explicitly address interaction.
- **Q12c:** Contact receives claim link but doesn't know what Aegis is — how much onboarding/explanation does the claim portal need? Is this a full branded experience or minimal?

**Answers:** 30-day grace period after cancellation, active cascades complete before stopping, 90-day archive, then delete. Yes, multiple switches simultaneously (independent state machines). Claim portal = clean, professional, branded experience — contact needs enough context to understand what's happening and trust the process.

---

## FOLLOW-UP QUESTIONS (from Eric's answers)

### F1: DOMAIN & BRANDING
- Domain preference? → aegisdms.life (recommended, pending registration). Also aegisdms.live available.

### F2: GITHUB ORG
- Personal account or org? → Can use personal, decided on aegis-dms org.

### F3: EXISTING CODE
- Start from scratch or port EliteRecall patterns? → Scratch, but EliteRecall as pattern reference. After analysis, only ~250 lines would be reusable — not worth porting.

### STACK PIVOT
- Original PRD specified Python/FastAPI. After discussion about consistency, solo-dev efficiency, shared types between frontend/backend, and the minimal reuse from EliteRecall — **final decision: TypeScript everywhere** (Fastify + React/Vite + Drizzle ORM).

---

## POST-REVIEW AMENDMENTS (2026-05-06)

Based on independent security and strategy reviews, the following amendments apply to all answers above:

### SECURITY AMENDMENTS
- **CORS:** Explicit origin allowlist (not `origin: true`). OSS allows `AEGIS_APP_URL`. SaaS allows `baseUrl`.
- **CSRF:** Signed double-submit cookie pattern on all state-changing routes.
- **Password reset (SaaS):** Tokens stored as SHA-256 hash, single-use, 15-minute expiry (not 1 hour).
- **Default secrets:** Production startup MUST fail if secrets contain "change-me" or are < 32 chars.
- **Field encryption scope expanded:** Institution name, account type, reference hint, contact name, relationship, Telegram handle all encrypted at rest.
- **Audit log redaction:** No plaintext sensitive data in audit metadata.
- **Rate limiting:** Required on auth, check-in, claim, and relay endpoints.
- **Reauthentication:** Required for sensitive actions (view keys, change contacts/triggers, connect relay).

### KEY MANAGEMENT AMENDMENT
- **v1:** Local key release (OSS), Relay escrow (paid — be honest that Relay is trusted).
- **Shamir's Secret Sharing:** Deferred to post-alpha. Premature implementation is security theater.
- **Key lifecycle:** Document generation, storage, rotation, destruction, compromise handling.

### RELAY REGISTRATION AMENDMENT
- **API keys MUST NOT be in URL query strings.** Use authorization code exchange (5-min expiry, single-use code, state validation, server-to-server key exchange).

### ARCHITECTURE AMENDMENT
- **packages/contracts/** added to both repos: DeadDrop protocol types (packet envelope, release run, heartbeat, claim event, webhook, storage/notification provider interfaces).
- **Protocol-oriented design:** Internal implementations must conform to contract schemas for future API extraction.
- **Release run constraint:** Only one active release run per owner at a time.

### TIMELINE AMENDMENT
- **4-week target = alpha**, not production. Production requires: security review, failure-mode testing, legal/privacy copy, key management protocol doc, non-technical contact testing.

### POSITIONING AMENDMENT
- **Aegis = legacy-release infrastructure for apps and individuals.**
- Product hierarchy: Aegis Core (OSS) → Aegis Relay (paid) → DeadDrop API (future B2B) → Aegis Hosted (future consumer).
- v1 focus: Core + Relay. Hosted SaaS = marketing shell + billing skeleton only.

### MODE NAMING AMENDMENT
- No external services → **Vault Mode** (not a DMS — just planning/storage).
- Local notifications → **Local Mode**.
- S3 sync → **Dead Drop Mode**.
- SaaS monitoring → **Relay Mode**.
- Fully managed → **Hosted Mode**.
