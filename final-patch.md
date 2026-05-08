# Aegis DMS — Final Patch Directive

## Purpose

This document captures the final cleanup items that should be applied to the current Aegis planning documents before implementation proceeds.

The current architecture is largely nailed down. This is **not** another strategic rewrite. The product surfaces are now clear:

1. **Aegis Core** — open-source, self-hosted app.
2. **Aegis Relay** — paid SaaS feature for self-hosted users.
3. **Aegis Hosted** — fully managed SaaS for non-technical users.
4. **DeadDrop API** — future infrastructure/API product for third-party integrations.

The remaining issues are mostly **plan consistency, schema-contract cleanup, and security-hardening details**.

After applying this patch, implementation can proceed.

---

# 1. Current State Assessment

The product map is now correct.

The planning docs clearly delineate:

- **Aegis Core**
- **Aegis Relay**
- **Aegis Hosted**
- **DeadDrop API**

The deployment modes are also properly split:

- **Vault Mode**
- **Dead Drop**
- **Relay Monitoring**
- **Relay Escrow**
- **Hosted**

This is the right direction.

The key strategy is:

```text
Build Aegis Core, Aegis Relay, and Aegis Hosted as real products.

Design their packet/release/heartbeat/claim contracts as the foundation for DeadDrop API.

Do not pivot away from Hosted or Relay.

Do not treat DeadDrop API as a replacement.

Treat DeadDrop API as the future platform layer that increases market size, moat, and B2B opportunity.
```

---

# 2. What Is Now Correct

## 2.1 Product Surface Delineation

The docs now properly define four product surfaces:

```text
Aegis Core:
  Open-source, self-hosted app.

Aegis Relay:
  Paid SaaS feature for self-hosted users.

Aegis Hosted:
  Fully managed SaaS product.

DeadDrop API:
  Future infrastructure/API product.
```

This avoids the earlier ambiguity where DeadDrop API could be interpreted as replacing Aegis Hosted or Aegis Relay.

That is now resolved.

---

## 2.2 DeadDrop API Positioning

The master plan now correctly treats DeadDrop API as a **future infrastructure layer**, not a replacement for Aegis Core, Relay, or Hosted.

This is the correct framing:

```text
Aegis DMS products powered by DeadDrop infrastructure.
```

Not:

```text
Aegis DMS or DeadDrop API.
```

The planning docs now include future platform concepts such as:

- partner apps;
- API clients;
- scoped keys;
- webhooks;
- usage events;
- partner packets;
- partner release runs.

That is enough for the current stage, as long as the contracts are implemented early and kept compatible.

---

## 2.3 Key Management Direction

The key-management direction is now honest and usable.

The docs now correctly avoid:

- premature Shamir Secret Sharing;
- fake “zero knowledge” claims;
- implying Relay can release when it does not possess release material;
- collapsing Relay Monitoring and Relay Escrow into one vague mode.

The correct alpha model is:

```text
OSS Local / Dead Drop:
  Local key release only.

Relay Monitoring:
  SaaS tracks heartbeats and sends alerts, but the local host may still be required for final release.

Relay Escrow:
  User explicitly authorizes SaaS to hold or access enough release material to execute release under configured conditions.

Hosted:
  Server-side encryption and server-managed release flow for v1.
```

Keep this model.

---

## 2.4 Relay Linking Flow

The Relay linking flow is now directionally correct.

It should use:

```text
short-lived authorization code
state validation
server-to-server exchange
single-use code
API key hash stored in SaaS
encrypted API key stored locally
audit events on both sides
```

Do **not** pass API keys through URL query strings.

---

## 2.5 OSS Field Encryption

The OSS schema is now in good shape.

It encrypts sensitive estate/contact fields such as:

- institution name;
- account type;
- reference hint;
- asset description;
- location notes;
- executor notes;
- contact full name;
- contact relationship;
- contact email;
- contact phone;
- contact Telegram handle;
- backup notes.

This should remain the standard.

---

# 3. Final Required Patches

Apply the following patches before continuing implementation.

---

# 4. Patch 1 — Fix SaaS Sensitive Field Encryption

## Problem

The master plan says field-level encryption applies to all sensitive estate/contact fields.

However, the SaaS Phase 1 schema still appears to store several sensitive fields in plaintext, including:

```ts
institutionName: text('institution_name')
accountType: text('account_type')
referenceHint: text('reference_hint')
```

Depending on the current version, it may also leave contact fields like these plaintext:

```ts
fullName
relationship
telegramHandle
```

This contradicts the security model.

## Required Change

Patch the SaaS schema to match the OSS encryption standard.

Replace plaintext columns:

```ts
institutionName
accountType
referenceHint
fullName
relationship
telegramHandle
```

with encrypted columns:

```ts
institutionNameEncrypted
accountTypeEncrypted
referenceHintEncrypted
fullNameEncrypted
relationshipEncrypted
telegramHandleEncrypted
```

## Recommended SaaS Estate Table Shape

```ts
export const estateItems = pgTable('estate_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Plaintext operational fields
  category: text('category').notNull(),
  title: text('title').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  sensitiveFlag: boolean('sensitive_flag').notNull().default(false),

  // Encrypted sensitive fields
  institutionNameEncrypted: text('institution_name_encrypted'),
  accountTypeEncrypted: text('account_type_encrypted'),
  referenceHintEncrypted: text('reference_hint_encrypted'),
  assetDescriptionEncrypted: text('asset_description_encrypted'),
  locationNotesEncrypted: text('location_notes_encrypted'),
  executorNotesEncrypted: text('executor_notes_encrypted'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

## Recommended SaaS Contacts Table Shape

```ts
export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Plaintext operational fields
  priorityOrder: integer('priority_order').notNull(),
  preferredChannels: jsonb('preferred_channels').notNull().default(['email']),
  confirmationWindowHours: integer('confirmation_window_hours').notNull().default(48),
  claimPinHash: text('claim_pin_hash'),

  // Encrypted sensitive fields
  fullNameEncrypted: text('full_name_encrypted').notNull(),
  relationshipEncrypted: text('relationship_encrypted'),
  emailEncrypted: text('email_encrypted').notNull(),
  phoneEncrypted: text('phone_encrypted'),
  telegramHandleEncrypted: text('telegram_handle_encrypted'),
  backupNotesEncrypted: text('backup_notes_encrypted'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

## Rationale

SaaS convenience is not a reason to store sensitive estate/contact metadata plaintext.

If the system needs these values for Helper Pack generation, notification delivery, claim flows, or hosted UX, decrypt server-side only when needed.

---

# 5. Patch 2 — Move SaaS Contract Package Into Phase 1

## Problem

The master plan includes `packages/contracts` for the SaaS repo and says it must stay compatible with OSS contracts.

However, the SaaS Phase 1 implementation plan appears to push compatible contracts to a later phase.

That risks early drift between OSS and SaaS.

## Required Change

Add this to SaaS Phase 1.

```text
Task 1B: DeadDrop Contract Package Compatibility
```

Create:

```text
packages/contracts/package.json
packages/contracts/tsconfig.json
packages/contracts/src/index.ts
packages/contracts/src/packet-envelope.ts
packages/contracts/src/release-run.ts
packages/contracts/src/heartbeat.ts
packages/contracts/src/claim-event.ts
packages/contracts/src/webhook-event.ts
packages/contracts/src/storage-provider.ts
packages/contracts/src/notification-provider.ts
packages/contracts/tests/contracts.test.ts
```

## Requirements

The SaaS contract package must:

- match the OSS contract package;
- use versioned `zod` schemas;
- export TypeScript types;
- validate packet/release/heartbeat/claim/webhook structures;
- include contract tests;
- fail tests if required contract fields drift.

## Long-Term Direction

Eventually, OSS and SaaS may consume the same published/internal contracts package.

For now, duplicated packages are acceptable, but they must not drift silently.

---

# 6. Patch 3 — Fix Pricing API Types

## Problem

The shared SaaS type currently treats pricing as always numeric:

```ts
price: number;
```

But the intended behavior is:

- if live pricing is available, show prices;
- if Stripe or pricing API is unavailable, hide exact prices and show a current-pricing link.

That requires nullable pricing.

## Required Change

Change:

```ts
export interface PricingPlan {
  id: SubscriptionPlan;
  name: string;
  price: number;
  currency: string;
  interval: 'month';
  features: string[];
}
```

to:

```ts
export interface PricingPlan {
  id: SubscriptionPlan;
  name: string;
  price: number | null;
  currency: string;
  interval: 'month';
  features: string[];
  pricingUrl?: string;
}
```

## API Behavior

For alpha, `/api/pricing` may use environment-configured fallback display values:

```text
AEGIS_RELAY_DISPLAY_PRICE=
AEGIS_HOSTED_DISPLAY_PRICE=
```

If unavailable, return:

```json
{
  "plans": [
    {
      "id": "relay",
      "name": "Aegis Relay",
      "price": null,
      "currency": "USD",
      "interval": "month",
      "features": [],
      "pricingUrl": "https://aegisdms.life/pricing"
    },
    {
      "id": "hosted",
      "name": "Aegis Hosted",
      "price": null,
      "currency": "USD",
      "interval": "month",
      "features": [],
      "pricingUrl": "https://aegisdms.life/pricing"
    }
  ]
}
```

## OSS App Behavior

If pricing API succeeds:

```text
Show current plan names, features, and prices.
```

If pricing API fails or prices are null:

```text
Hide exact prices and show a link to the current SaaS pricing page.
```

Do not hard-code final product pricing in the app while prices are placeholders.

---

# 7. Patch 4 — Make CSRF Phase 1 in Both Repos

## Problem

The master plan says CSRF protection is required from day one, but some phase-plan language suggests CSRF may be “Phase 1 or early Phase 2.”

For this app, CSRF should be foundational auth plumbing.

## Required Change

Implement CSRF in Phase 1 for both:

```text
aegis/
aegis-dms-site/
```

## Required API

Add:

```text
GET /api/csrf
```

## Behavior

```text
- Server issues signed CSRF token tied to the session.
- Client stores token in memory.
- All POST, PUT, PATCH, and DELETE requests include X-CSRF-Token.
- Server rejects missing, invalid, expired, or mismatched CSRF tokens.
```

## Frontend API Client Pattern

```ts
await fetch('/api/some-route', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify(payload),
});
```

## Cookie / CORS Requirements

```text
HttpOnly cookies
Secure cookies in production
SameSite=Lax or SameSite=Strict
Explicit CORS allowlist
No wildcard CORS with credentials in production
```

## Required Tests

Add tests for:

```text
valid CSRF token accepted
missing CSRF token rejected
invalid CSRF token rejected
expired CSRF token rejected
CSRF token from another session rejected
```

---

# 8. Patch 5 — Remove or Soften Time-Based Wording

## Problem

The user does not want the build agents over-anchoring on estimates such as:

```text
4-week alpha
8-week v1
Week 1 / Week 2 / Week 3 / Week 4
```

Phase ordering matters. Calendar timing does not.

## Required Change

Replace calendar-driven headings where possible.

Change:

```text
Build Stages (4-Week Alpha Target)
```

to:

```text
Build Stages / Logical Sequencing
```

Change:

```text
targeting a 4-week alpha
```

to:

```text
targeting an alpha that proves the architecture and core workflows
```

If week labels remain, add this note near the top of every plan:

```text
Phase labels are sequencing guidance, not fixed delivery estimates. Implementation should optimize for correctness, security, and coherent architecture over calendar targets.
```

## Rationale

The implementation should not cut security, contracts, or schema correctness to fit arbitrary time boxes.

---

# 9. Patch 6 — Add Explicit `release_runs` Tables

## Problem

The master plan correctly defines the release-run constraint:

```text
Only one active release run per owner/user at a time.
```

However, the implementation plans emphasize switches, packets, and contact claims. The release run should be a first-class table/entity in both OSS and SaaS.

Do not implement release state implicitly across `switches`, `packets`, and `contact_claims`.

## Required Change

Add explicit `release_runs` tables to both repos.

## OSS `release_runs` Table

Recommended shape:

```ts
export const releaseRuns = sqliteTable('release_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  triggeringSwitchId: integer('triggering_switch_id')
    .notNull()
    .references(() => switches.id),

  status: text('status').notNull().default('active'),

  activePacketId: integer('active_packet_id')
    .references(() => packets.id),

  currentContactClaimId: integer('current_contact_claim_id')
    .references(() => contactClaims.id),

  suppressedSwitchIds: text('suppressed_switch_ids').notNull().default('[]'),
  metadata: text('metadata'),

  startedAt: integer('started_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  cancelledAt: integer('cancelled_at', { mode: 'timestamp' }),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
```

## SaaS `release_runs` Table

Recommended shape:

```ts
export const releaseRuns = pgTable('release_runs', {
  id: uuid('id').primaryKey().defaultRandom(),

  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  triggeringSwitchId: uuid('triggering_switch_id')
    .notNull()
    .references(() => switches.id),

  status: text('status').notNull().default('active'),

  activePacketId: uuid('active_packet_id')
    .references(() => packets.id),

  currentContactClaimId: uuid('current_contact_claim_id')
    .references(() => contactClaims.id),

  suppressedSwitchIds: jsonb('suppressed_switch_ids').notNull().default([]),
  metadata: jsonb('metadata'),

  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  cancelledAt: timestamp('cancelled_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

## Required Rule

```text
Only one active release run may exist per owner/user at a time.
```

## Required Behavior

If another switch triggers while a release run is active:

```text
- attach the trigger event to the existing release run; or
- mark the second trigger as suppressed_by_active_release_run; or
- queue it for review;
- do not start a parallel cascade to the same contacts.
```

## Required Tests

Add tests for:

```text
two armed switches exist
first switch triggers and creates release run
second switch triggers while release run is active
no second cascade starts
audit event records suppression/attachment behavior
release run completes
new release run can start after completion if appropriate
```

---

# 10. Patch 7 — Add Trust Acknowledgement Records

## Problem

Relay Escrow and Hosted are trust models, not merely technical modes.

Relay Escrow especially requires the user to explicitly acknowledge that Aegis SaaS may hold release material or release authority sufficient to execute release if the local host is offline.

This should be schema-backed.

## Required Change

Add a `trust_acknowledgements` table in SaaS.

Optionally add a similar table in OSS for local acknowledgement of Vault/Dead Drop/Relay limitations.

## SaaS `trust_acknowledgements` Table

Recommended shape:

```ts
export const trustAcknowledgements = pgTable('trust_acknowledgements', {
  id: uuid('id').primaryKey().defaultRandom(),

  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  mode: text('mode').notNull(), // relay_escrow | hosted

  version: text('version').notNull(),

  acceptedAt: timestamp('accepted_at').notNull().defaultNow(),

  ipHash: text('ip_hash'),
  userAgentHash: text('user_agent_hash'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

## OSS Optional Table

```ts
export const localAcknowledgements = sqliteTable('local_acknowledgements', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  mode: text('mode').notNull(), // vault | dead_drop | relay_monitoring | relay_escrow
  version: text('version').notNull(),

  acceptedAt: integer('accepted_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
```

## Required UX

Before enabling Relay Escrow, user must acknowledge:

```text
Relay Escrow increases release resilience by allowing Aegis SaaS to execute your configured release policy if your self-hosted server remains offline. This requires trusting Aegis SaaS with release authority or release material according to the selected configuration.
```

Before enabling Hosted, user must acknowledge:

```text
Aegis Hosted is a managed service. Aegis SaaS stores and processes your encrypted legacy packet and executes release workflows under your configured policy. This is different from self-hosting.
```

Before using Vault Mode, user should acknowledge:

```text
Vault Mode stores and organizes your legacy information locally. It does not guarantee automated release if this machine is offline, destroyed, inaccessible, or unable to notify your contacts.
```

## Rationale

Trust-model acceptance should be durable, auditable, and versioned.

---

# 11. Patch 8 — Final Consistency Checks

After applying the above patches, run a consistency pass across:

```text
update.md / update(1).md
2026-05-06-aegis-master-plan.md
2026-05-06-aegis-oss-phase1.md
2026-05-06-aegis-saas-phase1.md
```

Check for contradictions in these areas:

## Product Names

Use consistently:

```text
Aegis Core
Aegis Relay
Aegis Hosted
DeadDrop API
Aegis DMS Site
```

## Repo Names

Use consistently:

```text
aegis/
aegis-dms-site/
```

Avoid older names such as:

```text
aegis-saas/
```

unless explicitly referencing a superseded draft.

## Deployment Modes

Use consistently:

```text
vault
dead_drop
relay_monitoring
relay_escrow
hosted
```

Avoid older values:

```text
local_only
relay
```

unless included only as migration notes.

## Security Model

Ensure all docs agree:

```text
No Shamir in alpha.
No zero-knowledge claims in alpha.
Relay Monitoring does not equal Relay Escrow.
SaaS sensitive estate/contact metadata encrypted at rest.
Audit logs do not contain plaintext PII.
CSRF is Phase 1.
Default secrets fail in production.
API keys are never passed in URLs.
```

## Pricing

Ensure all docs agree:

```text
Prices are placeholders.
Pricing API supports null price.
OSS hides price if unavailable.
Post-alpha pricing should read Stripe Price objects.
```

## Release Runs

Ensure all docs agree:

```text
Only one active release run per owner/user.
Release runs are first-class entities.
Parallel cascades are forbidden.
Suppressed/attached triggers are audited.
```

---

# 12. Final Go / No-Go Recommendation

After applying this final patch, the project is ready to proceed into implementation.

The remaining issues are not strategic. They are consistency and implementation-detail fixes.

## Go-Forward Criteria

Proceed when:

```text
1. SaaS sensitive field encryption matches OSS.
2. SaaS contracts package exists in Phase 1.
3. Pricing types support price: number | null.
4. CSRF is Phase 1 in both repos.
5. Time-driven wording is softened.
6. release_runs tables exist in both schemas.
7. trust_acknowledgements exists for Relay Escrow / Hosted.
8. Product names, repo names, deployment modes, and security claims are consistent.
```

## Final Direction

The strongest architecture is:

```text
Aegis DMS products powered by DeadDrop infrastructure.
```

The product strategy should remain:

```text
Aegis Core:
  Open-source trust and self-hosting wedge.

Aegis Relay:
  Paid reliability layer for self-hosters.

Aegis Hosted:
  Fully managed direct product for non-technical users.

DeadDrop API:
  Future B2B/platform layer built from the same packet, release, heartbeat, claim, notification, storage, and webhook contracts.
```

Do not perform another major strategic rewrite unless new evidence invalidates the current direction.

Patch the above issues, then build.
