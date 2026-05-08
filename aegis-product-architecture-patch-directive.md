# Aegis DMS / DeadDrop API — Product Architecture Patch Directive

## Purpose

This document is a patch directive for the current Aegis planning documents. It should be applied before continuing implementation.

The goal is **not** to replace Aegis DMS with DeadDrop API.

The goal is to make the full product strategy clearer:

1. **Aegis Core** — open-source, self-hosted app.
2. **Aegis SaaS** — commercial hosted platform with two user-facing functions:
   - **Aegis Relay** — cloud monitoring and release-assist layer for self-hosted users.
   - **Aegis Hosted** — fully managed version for users who do not want to self-host.
3. **DeadDrop API** — infrastructure/productization layer that exposes the core legacy-packet, heartbeat, release-run, claim, storage, notification, and webhook mechanics for third-party apps and future partner integrations.

These are related but distinct products. The build should support all three directions.

Do **not** interpret the DeadDrop API pivot as a reason to shelve or deprioritize Aegis Hosted or Aegis Relay. Instead, implement the system so the same core contracts and concepts power:

- the open-source self-hosted app;
- the hosted commercial app;
- the relay service;
- and, later, the public DeadDrop API / SDK product.

Time estimates such as “4 weeks to alpha” or “8 weeks to v1” should not drive architecture decisions. Treat phases as logical delivery layers, not calendar commitments.

---

# 1. Product Delineation

## 1.1 Aegis Core

**Aegis Core** is the open-source, self-hosted product.

Primary audience:

- self-hosters;
- homelab users;
- privacy-conscious users;
- technical users who want to run their own legacy-release system;
- people who prefer Docker/Unraid/TrueNAS/VPS/Pi deployments.

License:

- AGPL-3.0.

Repo:

```text
aegis/
```

Primary characteristics:

- single-owner for v1;
- SQLite database;
- Docker deployment;
- local auth with Argon2id, DB-backed sessions, optional TOTP;
- field-level AES-256-GCM encryption;
- user-configured SMTP/Telegram;
- user-configured S3-compatible storage;
- local worker polling loop;
- optional connection to Aegis Relay;
- DeadDrop protocol contracts implemented locally.

Aegis Core should be useful on its own, even without SaaS. It should not be crippleware.

Free OSS should include:

- local estate/contact data management;
- trip and heartbeat switch modes;
- packet generation;
- encrypted packet creation;
- S3-compatible dead-drop sync;
- user-configured notification providers;
- basic contact cascade;
- audit log;
- release simulation/test mode;
- deployment-mode warnings.

Paid SaaS value should come from reliability, ease of use, managed delivery, hosted claim portal, monitoring, and Helper Pack functionality — not from artificially withholding the core self-hosted mechanism.

---

## 1.2 Aegis SaaS

**Aegis SaaS** is the proprietary commercial platform.

Repo:

```text
aegis-saas/
```

Aegis SaaS has two major user-facing commercial functions:

1. **Aegis Relay**
2. **Aegis Hosted**

It may also later expose **DeadDrop API** as a B2B/platform product.

Primary characteristics:

- PostgreSQL database;
- multi-user auth;
- Stripe billing;
- managed notifications;
- managed R2/S3-compatible storage;
- hosted claim portal;
- relay monitoring;
- hosted app dashboard;
- admin dashboard;
- commercial Helper Pack;
- API/SDK platform primitives over time.

Aegis SaaS should not be treated only as a consumer-hosted app. It should be built as a commercial platform that serves:

- direct hosted users;
- self-hosted users who want Relay;
- and future partner/developer integrations via DeadDrop API.

---

## 1.3 Aegis Relay

**Aegis Relay** is part of Aegis SaaS.

It is the paid reliability layer for Aegis Core users who still want to self-host their primary app but want cloud-backed monitoring and fallback behavior.

Relay should support two clearly named modes:

### Relay Monitoring

Relay Monitoring detects missed heartbeats and sends alerts/fallback notifications, but the self-hosted Aegis Core instance still performs final release if online.

Relay Monitoring may provide:

- heartbeat tracking;
- offline detection;
- owner alerts;
- contact warning notifications;
- dashboard status;
- delivery monitoring;
- operational audit events.

Relay Monitoring should **not** claim it can complete release if it does not possess enough release material to do so.

### Relay Escrow

Relay Escrow is an explicit paid/trusted mode where the user opts into SaaS-held release material or release authority sufficient for SaaS to complete the configured release flow if the local host remains offline.

Relay Escrow may provide:

- hosted claim portal;
- cloud-controlled release execution;
- fallback contact cascade;
- managed notification retries;
- packet/key release according to configured policy;
- release receipts;
- contact acknowledgement tracking.

Relay Escrow must be honest in product copy and UX:

> In Relay Escrow mode, Aegis SaaS becomes a trusted release service. This increases resilience but requires trusting Aegis with release authority or release material under the configured policy.

Do not imply “zero knowledge” unless the cryptographic protocol actually proves that claim while still allowing offline release.

---

## 1.4 Aegis Hosted

**Aegis Hosted** is the fully managed product for non-technical users.

It is also part of Aegis SaaS.

Primary audience:

- spouses/families who do not want to self-host;
- estate-planning users;
- people who want the outcome without Docker, S3 setup, SMTP setup, or Tailscale;
- users who want managed notifications, hosted claim portal, billing, and support.

Hosted should include:

- managed dashboard;
- managed estate/contact data;
- managed packets;
- managed switch engine;
- managed claim portal;
- managed notifications;
- managed storage;
- billing;
- Helper Pack;
- guided onboarding;
- legal/privacy disclaimers.

Aegis Hosted should not be shelved because of the DeadDrop API direction. Hosted is still an important direct product and a reference implementation of the same infrastructure.

---

## 1.5 DeadDrop API

**DeadDrop API** is the infrastructure/platform product.

It is not a replacement for Aegis Core, Aegis Relay, or Aegis Hosted.

It is the productization of the underlying release infrastructure so other applications can embed digital legacy, emergency access, and encrypted release workflows.

Potential customers:

- estate-planning SaaS;
- online will/trust platforms;
- secure document vaults;
- crypto inheritance tools;
- self-custody platforms;
- family-office tooling;
- financial organizer apps;
- insurance-adjacent products;
- smaller password/security apps that do not want to build release infrastructure.

DeadDrop API should eventually expose:

- packet envelope creation;
- release run management;
- heartbeat monitoring;
- notification/cascade events;
- claim portal flows;
- webhook events;
- storage provider integrations;
- partner app API keys;
- scoped tokens;
- usage metering;
- SDKs;
- OpenAPI docs.

DeadDrop API does **not** need to be a public shipping product in the first implementation pass, but the contracts and internal architecture should be designed as if it will become one.

---

# 2. Strategy Clarification

## 2.1 Do Not Pivot Away From Aegis DMS

Do not read the DeadDrop API idea as a full product pivot.

The strategic direction is:

```text
Aegis Core proves the self-hosted use case.
Aegis Relay monetizes reliability for self-hosters.
Aegis Hosted serves non-technical direct users.
DeadDrop API productizes the infrastructure for partners.
```

All four are valid and compatible.

The build should not choose between:

- hosted platform;
- relay service;
- and DeadDrop API.

Instead, build a platform where all three SaaS-facing paths share compatible contracts and domain models.

---

## 2.2 Aegis Core as Reference Implementation

Aegis Core should function as:

1. a real, useful open-source app;
2. a trust-building artifact for privacy-conscious users;
3. a technical reference implementation of the DeadDrop protocol;
4. a lead generator for Aegis Relay;
5. a source of product feedback before broader hosted/partner expansion.

This means the OSS app should not be intentionally weakened.

The SaaS upsell should be based on:

- reliability;
- monitoring;
- managed notification delivery;
- hosted claim portal;
- easier setup;
- offline fallback;
- support;
- Helper Pack;
- no need to maintain personal infrastructure.

---

## 2.3 Aegis Hosted as Direct Consumer / Family Product

Aegis Hosted remains a valid product.

It should not be deferred indefinitely merely because DeadDrop API has a stronger long-term B2B profile.

Hosted helps validate:

- onboarding;
- user language;
- claim portal UX;
- contact cascade UX;
- Helper Pack value;
- pricing;
- trust positioning;
- support workflows.

Hosted also demonstrates to future DeadDrop API customers that the infrastructure works in a real product.

---

## 2.4 DeadDrop API as Platform Expansion

DeadDrop API should be treated as a future platform/business model that grows out of the same infrastructure.

The current build should add the right foundation:

- formal contracts;
- versioned packet envelopes;
- release-run model;
- heartbeat schema;
- claim-event schema;
- webhook-event schema;
- provider interfaces;
- contract tests;
- clean service boundaries.

But the first implementation does not need to expose a public developer portal, SDK, or partner dashboard unless that becomes explicitly prioritized later.

---

# 3. Required Patch: Master Plan

Add a new section to the master implementation plan:

```text
## Future Platform Layer: DeadDrop API
```

Use this language:

```text
DeadDrop API is the future infrastructure/platform layer behind Aegis.

It is not a replacement for Aegis Core, Aegis Relay, or Aegis Hosted.

Aegis Core, Aegis Relay, and Aegis Hosted should be built as real products. At the same time, the packet, heartbeat, release-run, claim-event, webhook, storage, and notification contracts should be designed as if they may later become public partner APIs.

The goal is to avoid building Aegis as a narrow one-off dead man’s switch. Instead, the architecture should support a future where third-party apps can embed Aegis-style encrypted legacy release and emergency access workflows using DeadDrop API.
```

Add the following future DeadDrop platform entities to the SaaS roadmap, even if they are not built immediately:

```text
partner_apps
api_clients
api_keys
api_key_scopes
webhook_endpoints
webhook_deliveries
usage_events
metered_usage_rollups
partner_release_runs
partner_packets
partner_claim_events
```

Add future API/SDK deliverables:

```text
OpenAPI spec
TypeScript SDK
Webhook signing
Example partner integration
Partner dashboard
Usage/metering dashboard
API docs
```

Clarify:

```text
These are platform expansion items. They should inform architecture now, but they do not block the initial Aegis Core, Relay, or Hosted implementation.
```

---

# 4. Required Patch: Product Boundary Language

Add a clear product map to the overview and master plan:

```text
Product Map

1. Aegis Core
   - Open-source self-hosted app.
   - AGPL-3.0.
   - SQLite, Docker, single-owner.
   - Useful without SaaS.
   - Can optionally connect to Relay.

2. Aegis Relay
   - Paid SaaS feature for self-hosted users.
   - Provides cloud heartbeat monitoring, hosted claim portal, fallback notifications, and optional Relay Escrow.
   - Does not replace the local app.

3. Aegis Hosted
   - Paid fully managed SaaS app.
   - For non-technical users who do not want to self-host.
   - Uses the same domain concepts but runs fully inside Aegis SaaS.

4. DeadDrop API
   - Future infrastructure/API product.
   - Lets third-party platforms embed encrypted legacy packet, release-run, heartbeat, claim, webhook, notification, and storage workflows.
   - Should be designed for from day one through contracts, but does not replace the direct Aegis products.
```

---

# 5. Required Patch: Contracts Package

The master plan and overview already reference `packages/contracts`, but the phase implementation plan must explicitly create it.

Add this to OSS Phase 1.

## Task 1B: DeadDrop Contract Package

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

Use `zod` schemas and exported TypeScript types.

The contract package should define the canonical domain boundaries for:

- packet envelope;
- release run;
- heartbeat request/response;
- claim event;
- webhook event;
- storage provider interface;
- notification provider interface.

The schemas should be versioned.

Example pattern:

```ts
export const DEAD_DROP_PACKET_ENVELOPE_VERSION = '2026-05-01';

export const DeadDropPacketEnvelopeSchema = z.object({
  schemaVersion: z.literal(DEAD_DROP_PACKET_ENVELOPE_VERSION),
  packetId: z.string(),
  ownerId: z.string().optional(),
  sourceApp: z.enum(['aegis_core', 'aegis_hosted', 'partner']),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  encryption: z.object({
    algorithm: z.literal('aes-256-gcm'),
    keyId: z.string(),
    iv: z.string(),
    authTag: z.string(),
  }),
  contentHash: z.string(),
  encryptedObjectHash: z.string().nullable(),
  storage: z.object({
    provider: z.string(),
    bucket: z.string().optional(),
    objectKey: z.string().optional(),
    region: z.string().optional(),
  }).nullable(),
});
```

The exact schema can evolve, but the important point is that the contract package exists early and is treated as the future DeadDrop API foundation.

Because the repos are separate, the SaaS repo should either:

1. maintain a compatible `packages/contracts` package of its own; or
2. consume a published/internal package once the contract is stable.

Do not allow OSS and SaaS contract shapes to drift silently.

Add contract tests in both repos.

---

# 6. Required Patch: SaaS Schema Encryption

The OSS schema correctly encrypts sensitive estate/contact metadata.

The SaaS schema must match this standard.

Do not store these fields plaintext in SaaS:

```text
institutionName
accountType
referenceHint
fullName
relationship
telegramHandle
```

Change to encrypted columns:

```text
institutionNameEncrypted
accountTypeEncrypted
referenceHintEncrypted
fullNameEncrypted
relationshipEncrypted
telegramHandleEncrypted
```

Recommended plaintext SaaS estate/contact fields:

```text
id
userId
category
title
priorityOrder
preferredChannels
confirmationWindowHours
status fields
sortOrder
createdAt
updatedAt
```

Recommended encrypted SaaS fields:

```text
institutionNameEncrypted
accountTypeEncrypted
referenceHintEncrypted
assetDescriptionEncrypted
locationNotesEncrypted
executorNotesEncrypted
fullNameEncrypted
relationshipEncrypted
emailEncrypted
phoneEncrypted
telegramHandleEncrypted
backupNotesEncrypted
```

If the system needs to use these fields for Helper Pack generation or notification delivery, decrypt them server-side only when needed.

Do not use Helper Pack or managed SaaS convenience as a reason to keep sensitive estate/contact metadata plaintext at rest.

---

# 7. Required Patch: Claim Portal Reachability and Arming Gates

A switch should not be allowed to arm for automated release unless its release path is actually viable.

Add a readiness check before arming.

## Required Readiness Checks

A switch may be armed only if:

```text
1. At least one contact is selected.
2. At least one estate item or instruction packet is selected.
3. Owner authentication is configured.
4. Notification provider is configured and tested, unless the selected mode explicitly does not support notifications.
5. Packet generation succeeds.
6. Packet encryption succeeds.
7. Packet storage succeeds if using Dead Drop, Relay Escrow, or Hosted.
8. Claim portal URL is reachable, or Relay/Hosted claim portal is enabled.
9. Key-release path is configured for the selected deployment mode.
10. User has acknowledged the limitations of the selected mode.
```

If any readiness check fails, the switch remains in `draft` or `not_ready` state.

Add a structured readiness response:

```ts
type ReadinessStatus = 'ready' | 'not_ready' | 'warning';

interface ReadinessCheck {
  id: string;
  label: string;
  status: ReadinessStatus;
  required: boolean;
  message: string;
  resolutionHint?: string;
}
```

## Mode-Specific Rules

### Local-Only / Vault Mode

Local-only mode should be described carefully.

If no external notification provider and no reachable claim portal exists, the UX should call this:

```text
Vault Mode
```

or:

```text
Local Planning Mode
```

Do not imply this is a fully automated dead man’s switch.

Suggested copy:

```text
Vault Mode stores and organizes your legacy packet locally. It does not guarantee automated release if this machine is offline, destroyed, inaccessible, or unable to notify your contacts.
```

### Dead Drop Mode

Dead Drop Mode requires:

- S3-compatible storage configured;
- packet upload verified;
- packet hash verified;
- notification provider configured;
- public claim URL reachable or user acknowledges manual/limited release behavior.

### Relay Monitoring

Relay Monitoring requires:

- SaaS connection;
- heartbeat accepted;
- owner notification fallback configured;
- explicit language that Relay Monitoring detects offline status but may still depend on the local host for final release unless Relay Escrow is enabled.

### Relay Escrow

Relay Escrow requires:

- SaaS connection;
- heartbeat accepted;
- hosted claim portal enabled;
- release material configured;
- packet/key release policy configured;
- user acceptance that Aegis SaaS is trusted to execute the release policy.

### Hosted

Hosted requires:

- hosted packet generation;
- hosted storage;
- hosted notification provider;
- hosted claim portal;
- billing/subscription status where applicable.

---

# 8. Required Patch: Relay Monitoring vs Relay Escrow

The docs must distinguish these clearly.

## Relay Monitoring

Relay Monitoring:

- receives heartbeats;
- detects missed check-ins/offline state;
- sends alerts;
- displays status;
- may warn contacts;
- does not necessarily possess release authority;
- cannot claim guaranteed release if the local host is permanently offline and no escrow/release material exists.

## Relay Escrow

Relay Escrow:

- is explicitly opted into;
- may hold release material, encrypted packet references, or key material as configured;
- can execute the release path if the local host remains offline;
- is a trusted SaaS mode;
- should require clear user acknowledgement.

Recommended language:

```text
Relay Monitoring increases awareness. Relay Escrow increases release resilience.
```

Do not collapse these into one vague “Relay” behavior in the implementation.

---

# 9. Required Patch: Relay Linking Flow

Do not pass API keys through URL query strings.

Use an authorization-code style linking flow.

## Correct Flow

```text
1. User clicks “Connect to Relay” inside Aegis Core.
2. Aegis Core creates a local relay_link_nonce and state value.
3. Aegis Core opens Aegis SaaS connect URL with state and callback metadata.
4. User authenticates in Aegis SaaS.
5. SaaS creates a short-lived, single-use link code.
6. SaaS redirects back to the local app with code + state only.
7. Aegis Core backend validates state.
8. Aegis Core backend exchanges code server-to-server for a Relay API key.
9. SaaS stores only a hash of the API key.
10. Aegis Core stores the Relay API key encrypted locally.
11. Aegis Core sends a test heartbeat.
12. SaaS confirms the Relay connection is active.
```

Requirements:

```text
- Link code expires in 5–10 minutes.
- Link code is single-use.
- State must be validated.
- API key is never placed in URL query string.
- SaaS stores only API key hash.
- Local app stores API key encrypted.
- Linking flow writes audit events on both sides.
```

---

# 10. Required Patch: CSRF Implementation

The master plan says CSRF is required. The phase plans must explicitly implement it in both OSS and SaaS.

Add:

```text
GET /api/csrf
```

Behavior:

```text
- Server issues signed CSRF token tied to the session.
- Client stores CSRF token in memory.
- All POST, PUT, PATCH, and DELETE requests include X-CSRF-Token.
- Server rejects missing or invalid CSRF tokens.
- Tests cover missing, invalid, expired, and valid CSRF tokens.
```

Update frontend API clients:

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

Cookie requirements:

```text
HttpOnly
Secure in production
SameSite=Lax or SameSite=Strict
No wildcard CORS with credentials
Explicit CORS allowlist
```

---

# 11. Required Patch: Pricing API

The current pricing values are placeholders and should not be hard-coded as final product truth.

## Alpha Behavior

For alpha, `/api/pricing` may return configured fallback values from environment variables.

Example:

```text
AEGIS_RELAY_DISPLAY_PRICE=
AEGIS_HOSTED_DISPLAY_PRICE=
```

If not configured, the API can return:

```json
{
  "plans": [
    {
      "id": "relay",
      "name": "Aegis Relay",
      "price": null,
      "currency": "USD",
      "interval": "month",
      "pricingUrl": "https://aegisdms.life/pricing"
    }
  ]
}
```

## Post-Alpha Behavior

Post-alpha, `/api/pricing` should read Stripe Price objects using:

```text
STRIPE_RELAY_PRICE_ID
STRIPE_HOSTED_PRICE_ID
```

If Stripe is unavailable:

- return plan names and features;
- set price to `null`;
- show “View current pricing” link;
- do not show stale hard-coded prices.

OSS app behavior:

```text
If pricing API succeeds:
  show current plan names/features/prices.

If pricing API fails:
  hide exact prices and show link to current SaaS pricing page.
```

---

# 12. Required Patch: Key Management

Avoid premature or incorrect Shamir Secret Sharing claims.

For alpha:

```text
No Shamir Secret Sharing.
No “zero knowledge” claims unless fully designed and proven.
No claim that Relay can release without the local host unless Relay Escrow is configured.
```

Use this key model:

## OSS Local / Dead Drop

```text
Local key release only.
Highest privacy.
Lower resilience.
If the local host is gone and no Relay Escrow exists, automated release may fail.
```

## Relay Monitoring

```text
SaaS tracks heartbeats and sends alerts.
Local host still performs final release if online.
```

## Relay Escrow

```text
User explicitly authorizes SaaS to hold or access enough release material to execute release under configured conditions.
Higher resilience.
Requires trust in Aegis SaaS.
```

## Hosted

```text
Server-side encryption and server-managed release flow for v1.
Aegis SaaS is trusted infrastructure.
Future advanced mode may support client-side encryption or contact public-key encryption.
```

Add a future key-management design doc:

```text
docs/key-management.md
```

It should cover:

- key generation;
- storage;
- encryption algorithms;
- release material handling;
- rotation;
- revocation;
- deletion;
- compromise response;
- Relay Escrow;
- Hosted mode;
- future contact public-key encryption;
- future Shamir/post-alpha options.

---

# 13. Required Patch: Audit Logs

Audit logs should not leak sensitive data.

Audit events should include:

```text
event type
actor type
actor ID/reference
switch ID
release run ID
packet ID
timestamp
status
non-sensitive metadata
```

Audit events should not include:

```text
institution names
account numbers
contact names
contact emails
contact phone numbers
packet plaintext
executor notes
release key material
storage credentials
API keys
```

If metadata is necessary, store redacted or hashed versions.

Example:

```json
{
  "eventType": "contact_notified",
  "actorType": "system",
  "contactId": "contact_123",
  "channel": "email",
  "deliveryStatus": "queued"
}
```

Do not log:

```json
{
  "contactEmail": "actual-person@example.com"
}
```

---

# 14. Required Patch: SaaS Priorities Without Shelving Hosted

Do not remove Aegis Hosted from the roadmap.

Do not imply that DeadDrop API replaces Hosted or Relay.

Instead, organize SaaS implementation around shared infrastructure.

## SaaS Shared Foundation

Build these once and use across Relay, Hosted, and future DeadDrop API:

```text
auth
billing
users
subscriptions
field encryption
notification dispatch
packet service
release-run service
claim portal
storage service
worker loop
audit logging
API key infrastructure
contract validation
```

## Aegis Relay Path

Build:

```text
relay connection
authorization-code linking
heartbeat endpoint
relay status
offline detection
Relay Monitoring behavior
Relay Escrow behavior
hosted claim portal for relay users
fallback notifications
relay audit log
```

## Aegis Hosted Path

Build:

```text
hosted estate/contact CRUD
hosted switches
hosted packet generation
hosted storage
hosted notification dispatch
hosted claim portal
hosted release runs
billing/subscription gating
guided onboarding
```

## DeadDrop API Foundation

Build foundational pieces where natural:

```text
contract schemas
versioned packet envelopes
release-run schema
heartbeat schema
claim-event schema
webhook-event schema
storage provider interface
notification provider interface
API key model
usage event table
```

But public partner API, SDK, and developer portal can remain later-stage.

The key instruction:

```text
Build Hosted and Relay as real products. Build their internals so they naturally become DeadDrop API infrastructure later.
```

---

# 15. Required Patch: Release Run Constraint

Keep the global release-run rule.

Even if multiple switches exist, only one active release run may exist per owner/user at a time.

Rule:

```text
Multiple switches may be armed, but only one active release run may exist per owner/user at a time.
```

If another switch triggers while a release run is active:

```text
- attach the trigger event to the existing release run; or
- mark the second trigger as suppressed_by_active_release_run; or
- queue it for review;
- do not start a parallel cascade to the same contacts.
```

This prevents:

- duplicate contact notifications;
- conflicting packets;
- multiple claim flows;
- packet deletion race conditions;
- contact confusion.

Add tests for:

```text
- two armed switches, first triggers;
- second switch triggers during active release run;
- no second cascade starts;
- audit event records suppression/attachment behavior.
```

---

# 16. Required Patch: Deployment Mode Naming

Use user-facing names that communicate limitations.

Recommended labels:

```text
Vault Mode
Dead Drop Mode
Relay Monitoring
Relay Escrow
Hosted
```

Mapping:

```text
Vault Mode:
  Local-only planning/storage. No reliable automated release unless external notification/reachability exists.

Dead Drop Mode:
  Local app + encrypted packet synced to external S3-compatible storage.

Relay Monitoring:
  Self-hosted app + cloud heartbeat/offline monitoring. Local app may still be needed for final release.

Relay Escrow:
  Self-hosted app + cloud monitoring + trusted SaaS release authority/material.

Hosted:
  Fully managed SaaS.
```

Avoid using “Local-Only Dead Man’s Switch” in user-facing copy if there is no actual off-machine release path.

---

# 17. Required Patch: Public Copy / Positioning

Recommended positioning:

```text
Aegis is legacy-release infrastructure for apps and individuals.

Aegis Core helps self-hosters prepare and control encrypted legacy packets.

Aegis Relay adds cloud monitoring, hosted claim flows, and optional release escrow for self-hosted users.

Aegis Hosted gives non-technical users a fully managed way to prepare, monitor, and release critical estate information.

DeadDrop API will let third-party platforms embed encrypted legacy packet, heartbeat, claim, and release workflows into their own products.
```

Avoid positioning as only:

```text
A self-hosted dead man’s switch.
```

Better:

```text
Open-source and hosted legacy-release infrastructure.
```

or:

```text
Encrypted legacy packet release for self-hosters, families, and platforms.
```

---

# 18. Required Patch: Do Not Over-Anchor to Time Estimates

Remove or soften calendar-driven wording.

Instead of:

```text
Week 1
Week 2
Week 3
Week 4
```

Prefer:

```text
Phase 1: Foundation
Phase 2: Core Domain Logic
Phase 3: Packets, Storage, and Cascade
Phase 4: Productization and Deployment
```

If week labels remain, clarify:

```text
Phase labels are sequencing guidance, not fixed delivery estimates.
```

The implementation agents should optimize for correctness, security, and coherent architecture over calendar estimates.

---

# 19. Agent Patch Instruction

Use the following as the direct instruction to the build/planning agents:

```text
Patch the updated Aegis plans before continuing.

Important framing:
DeadDrop API is not replacing Aegis Core, Aegis Relay, or Aegis Hosted. Build Hosted and Relay as real products. Build their internals so they naturally become DeadDrop API infrastructure later. Do not shelve Hosted or Relay in favor of DeadDrop API. The correct model is four clearly delineated product surfaces: Aegis Core, Aegis Relay, Aegis Hosted, and DeadDrop API.

Remove or soften time-driven framing. Treat phases as sequencing guidance, not calendar commitments.

Required changes:

1. Add a “Future Platform Layer: DeadDrop API” section to the master plan.
   - Clarify that DeadDrop API is not Phase 1 shipping scope.
   - Clarify that it does not replace Aegis Core, Aegis Relay, or Aegis Hosted.
   - Require contracts to be designed for future partner/API use.
   - Add future platform entities: partner apps, scoped API keys, webhooks, usage metering, SDK, OpenAPI docs, sample integration.

2. Add clear product delineation:
   - Aegis Core = AGPL self-hosted app.
   - Aegis Relay = paid cloud monitoring/release-assist layer for self-hosted users.
   - Aegis Hosted = fully managed SaaS for non-technical users.
   - DeadDrop API = future infrastructure/API product for third-party apps.

3. Add packages/contracts to OSS Phase 1.
   - packet-envelope.ts
   - release-run.ts
   - heartbeat.ts
   - claim-event.ts
   - webhook-event.ts
   - storage-provider.ts
   - notification-provider.ts
   - zod schemas
   - versioned contracts
   - contract tests.

4. Ensure SaaS has compatible contract schemas or consumes the same published/internal contract package.
   - Do not allow OSS and SaaS DeadDrop contract shapes to drift silently.

5. Fix SaaS schema encryption.
   - Rename institutionName/accountType/referenceHint/fullName/relationship/telegramHandle to encrypted columns.
   - Keep only category, title, sort order, status, operational fields, and timestamps plaintext unless explicitly justified.
   - Match the OSS encryption standard.

6. Add claim portal reachability and readiness gates.
   - A switch cannot be armed for automated release unless notification, packet, storage, claim URL, contact, and key-release checks pass.
   - Local-only should be labeled Vault Mode or Local Planning Mode unless external notification/reachability is configured.

7. Split Relay into Relay Monitoring and Relay Escrow.
   - Relay Monitoring detects offline state and alerts, but local host may still be required for final release.
   - Relay Escrow is explicit trusted mode where SaaS can execute release if host is offline.

8. Fix Relay linking.
   - Use short-lived authorization-code exchange.
   - Never pass API keys in URL query strings.
   - SaaS stores only API key hash.
   - OSS stores API key encrypted locally.

9. Replace hard-coded pricing.
   - Alpha may use env-configured fallback display prices.
   - Post-alpha should read Stripe Price objects.
   - If pricing API fails, OSS hides exact prices and links to SaaS pricing.

10. Add CSRF implementation tasks to both OSS and SaaS.
   - GET /api/csrf.
   - X-CSRF-Token on POST/PUT/PATCH/DELETE.
   - Signed token tied to session.
   - Tests for missing/invalid/expired tokens.
   - Secure cookie settings and explicit CORS allowlist.

11. Keep Hosted and Relay implementation paths active.
   - SaaS shared foundation should serve Relay, Hosted, and future DeadDrop API.
   - Do not defer Hosted indefinitely.
   - Do not build DeadDrop API as a separate replacement product.
   - Build the shared internals so API productization is natural later.

12. Keep release-run constraint.
   - Only one active release run per owner/user at a time.
   - Multiple switches may exist and be armed, but parallel cascades must not occur.

13. Add or update docs:
   - docs/threat-model.md
   - docs/key-management.md
   - docs/release-modes.md
   - docs/deaddrop-contracts.md
   - docs/self-hosting.md
   - docs/relay.md
   - docs/hosted.md
```

---

# 20. Bottom-Line Direction

Proceed with the updated architecture after applying this patch.

The product direction should be:

```text
Build Aegis Core, Aegis Relay, and Aegis Hosted as real products.

Design their core packet/release/heartbeat/claim contracts as the foundation for DeadDrop API.

Do not pivot away from hosted/relay.

Do not treat DeadDrop API as a replacement.

Do treat DeadDrop API as the long-term platform layer that can increase market size, moat, and B2B opportunity.
```

The strongest architecture is not:

```text
Aegis DMS or DeadDrop API
```

It is:

```text
Aegis DMS products powered by DeadDrop infrastructure.
```
