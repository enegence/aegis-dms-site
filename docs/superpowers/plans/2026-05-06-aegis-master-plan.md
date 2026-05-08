# Aegis DMS — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two products in parallel — an open-source self-hosted digital legacy release system (Aegis Core) and a commercial SaaS platform (Aegis Hosted/Relay) — targeting a 4-week alpha. This is NOT production-ready at week 4; it is an alpha that proves the architecture and core workflows.

**Architecture:** Two separate repos, same TypeScript stack. OSS uses SQLite + Docker Compose for self-hosters. SaaS uses PostgreSQL + Railway for commercial hosting. Both share domain concepts (switches, cascades, contacts, packets) but implement them independently. SaaS serves both Relay customers (self-hosted + cloud monitoring) and fully-hosted customers.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, React, Vite, Tailwind CSS, Node crypto (AES-256-GCM), Argon2, Stripe, Postmark, SQLite (OSS), PostgreSQL (SaaS), Docker.

---

## Architecture Overview

### Two Products

```
┌─────────────────────────────────┐     ┌──────────────────────────────────┐
│  REPO 1: aegis-dms/aegis        │     │  REPO 2: aegis-dms-site (private)│
│  License: AGPL-3.0              │     │  License: Proprietary            │
│                                 │     │                                  │
│  Self-hosted Docker app         │     │  Commercial SaaS platform        │
│  SQLite database                │     │  PostgreSQL database             │
│  Single-owner auth              │     │  Multi-user auth + Stripe        │
│  Local worker (polling loop)    │     │  Managed worker + relay monitor  │
│  User-configured SMTP/Telegram  │     │  Managed Postmark + Telegram bot │
│  User-configured S3 storage     │     │  Managed R2/S3 storage           │
│                                 │     │                                  │
│  Optional: connects to SaaS ──────────►  Relay API: accepts heartbeats   │
│  via API key for Relay mode     │     │  Hosted mode: full managed app   │
└─────────────────────────────────┘     │  Claim portal: contact flow      │
                                        │  Marketing site: landing/pricing │
                                        │  Admin: user/metrics dashboard   │
                                        └──────────────────────────────────┘
```

### Deployment Modes (from PRD)

| Mode | Where app runs | Where data lives | Notifications | Resilience |
|------|---------------|------------------|---------------|------------|
| A: Vault Mode | User's Docker host | SQLite on host | User's SMTP/Telegram | Low — local planning/storage only; no reliable automated release unless external notification/reachability exists |
| B: Dead Drop | User's Docker host | SQLite + S3 encrypted packet | User's SMTP/Telegram | Medium — packet survives host loss |
| C1: Relay Monitoring | User's Docker + SaaS | SQLite + S3 + SaaS monitors | SaaS alerts; local host may still be needed for final release | Medium-High — increases awareness; local host may still be required for release |
| C2: Relay Escrow | User's Docker + SaaS | SQLite + S3 + SaaS holds release material | SaaS fallback notifications + hosted claim portal | High — SaaS can execute release under configured policy if local host is offline |
| D: Fully Hosted | SaaS (Railway) | PostgreSQL + managed S3 | Managed Postmark/Telegram | Highest — fully managed SaaS infrastructure |

### Product Map

1. **Aegis Core**
   - Open-source self-hosted app.
   - AGPL-3.0.
   - SQLite, Docker, single-owner.
   - Useful without SaaS.
   - Can optionally connect to Relay.

2. **Aegis Relay** (Monitoring + Escrow)
   - Paid SaaS feature for self-hosted users.
   - Provides cloud heartbeat monitoring, hosted claim portal, fallback notifications, and optional Relay Escrow.
   - Does not replace the local app.

3. **Aegis Hosted**
   - Paid fully managed SaaS app.
   - For non-technical users who do not want to self-host.
   - Uses the same domain concepts but runs fully inside Aegis SaaS.

4. **DeadDrop API**
   - Future infrastructure/API product.
   - Lets third-party platforms embed encrypted legacy packet, release-run, heartbeat, claim, webhook, notification, and storage workflows.
   - Should be designed for from day one through contracts, but does not replace the direct Aegis products.

---

## Repo 1: OSS File Structure

```
aegis/
├── README.md
├── LICENSE                        # AGPL-3.0
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── setup.sh                       # Interactive setup script
├── package.json                   # Workspace root
├── tsconfig.base.json
│
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   └── src/
│   │       └── types.ts           # Domain types shared server↔web
│   └── contracts/
│       ├── package.json
│       └── src/
│           ├── index.ts           # Barrel export
│           ├── packet-envelope.ts # DeadDrop Packet Envelope schema
│           ├── release-run.ts     # DeadDrop Release Run schema
│           ├── heartbeat.ts       # Heartbeat API request/response
│           ├── claim-event.ts     # Claim event schema
│           ├── webhook-event.ts   # Webhook event schema
│           ├── storage-provider.ts # Storage provider interface
│           └── notification-provider.ts # Notification provider interface
│
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── drizzle.config.ts
│   ├── src/
│   │   ├── index.ts               # Fastify app entry + static file serving
│   │   ├── config.ts              # Environment config with validation
│   │   ├── db/
│   │   │   ├── index.ts           # SQLite connection via better-sqlite3
│   │   │   ├── schema.ts          # Drizzle schema (all tables)
│   │   │   └── migrate.ts         # Migration runner
│   │   ├── auth/
│   │   │   ├── plugin.ts          # Fastify auth plugin (session check)
│   │   │   ├── password.ts        # Argon2id hash/verify
│   │   │   └── totp.ts            # TOTP generate/verify
│   │   ├── routes/
│   │   │   ├── auth.ts            # POST /login, /check-in, /logout, /setup
│   │   │   ├── estate.ts          # CRUD /api/estate-items
│   │   │   ├── contacts.ts        # CRUD /api/contacts + reorder
│   │   │   ├── switches.ts        # CRUD /api/switches + arm/pause/cancel/check-in
│   │   │   ├── packets.ts         # GET /api/packets, POST /api/packets/sync
│   │   │   ├── audit.ts           # GET /api/audit-log
│   │   │   ├── health.ts          # GET /health
│   │   │   ├── settings.ts        # GET/PUT /api/settings (notifications, storage)
│   │   │   ├── relay.ts           # POST /api/relay/connect, /api/relay/disconnect
│   │   │   └── claim.ts           # Public: GET /claim/:token, POST /claim/:token/*
│   │   ├── services/
│   │   │   ├── switch-engine.ts   # State machine: evaluate triggers, transitions
│   │   │   ├── cascade.ts         # Contact cascade: notify, escalate, complete
│   │   │   ├── packet.ts          # Build legacy packet JSON, encrypt, manage versions
│   │   │   ├── storage.ts         # S3-compatible: upload, download, verify, delete
│   │   │   ├── notifications.ts   # Dispatch: email (SMTP/API), Telegram, SMS
│   │   │   ├── crypto.ts          # AES-256-GCM encrypt/decrypt, key derivation, key lifecycle
│   │   │   ├── field-encrypt.ts   # Per-field encryption for sensitive DB columns
│   │   │   └── relay-client.ts    # Send heartbeats to SaaS relay endpoint
│   │   └── worker/
│   │       └── index.ts           # Polling loop: evaluate switches, send reminders, sync packets
│   └── tests/
│       ├── auth.test.ts
│       ├── estate.test.ts
│       ├── contacts.test.ts
│       ├── switches.test.ts
│       ├── crypto.test.ts
│       ├── cascade.test.ts
│       ├── switch-engine.test.ts
│       └── worker.test.ts
│
├── web/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                # Router + theme provider
│   │   ├── lib/
│   │   │   ├── api.ts             # Fetch wrapper with CSRF
│   │   │   └── theme.ts           # Theme tokens (blueprint/cream/midnight)
│   │   ├── components/
│   │   │   ├── ui/                # SketchCard, InkButton, StatPill, SectionTitle
│   │   │   ├── icons/             # Hand-drawn SVG icon components
│   │   │   ├── layout/            # AppShell, Sidebar
│   │   │   └── animations/        # Mortality scene components
│   │   ├── pages/
│   │   │   ├── Landing.tsx
│   │   │   ├── Setup.tsx          # First-run wizard (owner setup)
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Estate.tsx
│   │   │   ├── Contacts.tsx
│   │   │   ├── Trigger.tsx
│   │   │   ├── Release.tsx
│   │   │   ├── Deployment.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── AuditLog.tsx
│   │   │   └── claim/             # Contact claim portal (separate layout)
│   │   │       ├── ClaimLanding.tsx
│   │   │       ├── ClaimVerify.tsx
│   │   │       ├── ClaimAccept.tsx
│   │   │       ├── ClaimDownload.tsx
│   │   │       └── ClaimAcknowledge.tsx
│   │   └── hooks/
│   │       ├── useAuth.ts
│   │       ├── useApi.ts
│   │       └── useTheme.ts
│   └── public/
│       └── favicon.svg
│
└── docs/
    ├── self-hosting.md
    ├── storage-setup.md
    ├── notification-setup.md
    └── threat-model.md
```

## Repo 2: SaaS File Structure

```
aegis-dms-site/
├── README.md
├── docker-compose.yml             # Dev: PostgreSQL
├── railway.toml                   # Railway config
├── package.json
├── tsconfig.base.json
│
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   └── src/
│   │       └── types.ts
│   └── contracts/                     # Must stay compatible with OSS contracts
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── packet-envelope.ts
│           ├── release-run.ts
│           ├── heartbeat.ts
│           ├── claim-event.ts
│           ├── webhook-event.ts
│           ├── storage-provider.ts
│           └── notification-provider.ts
│
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── drizzle.config.ts
│   ├── src/
│   │   ├── index.ts
│   │   ├── config.ts
│   │   ├── db/
│   │   │   ├── index.ts           # PostgreSQL connection pool
│   │   │   ├── schema.ts          # Multi-user schema
│   │   │   └── migrate.ts
│   │   ├── auth/
│   │   │   ├── plugin.ts          # Session-based auth plugin
│   │   │   ├── password.ts        # Argon2id
│   │   │   ├── totp.ts
│   │   │   ├── session.ts         # DB-backed sessions
│   │   │   └── password-reset.ts  # Email-based reset flow
│   │   ├── routes/
│   │   │   ├── auth.ts            # Register, login, logout, reset, verify-email
│   │   │   ├── billing.ts         # Stripe: checkout, portal, webhook
│   │   │   ├── pricing.ts         # Public: GET /api/pricing (consumed by OSS)
│   │   │   ├── relay.ts           # POST /api/relay/heartbeat, GET /api/relay/status
│   │   │   ├── estate.ts          # Hosted user estate CRUD
│   │   │   ├── contacts.ts        # Hosted user contacts
│   │   │   ├── switches.ts        # Hosted user switches
│   │   │   ├── packets.ts         # Managed packet operations
│   │   │   ├── claim.ts           # Hosted claim portal
│   │   │   ├── settings.ts        # User settings
│   │   │   └── admin.ts           # Admin: user list, metrics, subscription overview
│   │   ├── services/
│   │   │   ├── switch-engine.ts
│   │   │   ├── cascade.ts
│   │   │   ├── packet.ts
│   │   │   ├── storage.ts         # Managed R2 storage
│   │   │   ├── notifications.ts   # Postmark + Telegram bot
│   │   │   ├── crypto.ts
│   │   │   ├── field-encrypt.ts
│   │   │   ├── stripe.ts          # Stripe helpers: create customer, checkout, portal
│   │   │   └── relay-monitor.ts   # Track heartbeats, detect offline, alert
│   │   └── worker/
│   │       └── index.ts           # Hosted switches + relay monitoring loop
│   └── tests/
│       ├── auth.test.ts
│       ├── billing.test.ts
│       ├── relay.test.ts
│       ├── estate.test.ts
│       └── cascade.test.ts
│
├── web/
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── lib/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── marketing/
│   │   │   │   ├── Landing.tsx     # Public landing page
│   │   │   │   ├── Pricing.tsx     # Plan comparison
│   │   │   │   ├── About.tsx
│   │   │   │   └── Docs.tsx
│   │   │   ├── auth/
│   │   │   │   ├── Register.tsx
│   │   │   │   ├── Login.tsx
│   │   │   │   └── ResetPassword.tsx
│   │   │   ├── app/               # Authenticated app pages
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Estate.tsx
│   │   │   │   ├── Contacts.tsx
│   │   │   │   ├── Trigger.tsx
│   │   │   │   ├── Settings.tsx
│   │   │   │   ├── Billing.tsx
│   │   │   │   └── RelayStatus.tsx # For relay customers: connected instances
│   │   │   ├── claim/             # Contact claim portal
│   │   │   └── admin/             # Admin dashboard
│   │   └── hooks/
│   └── public/
│
└── docs/
```

> **Contract compatibility:** Because the repos are separate, the SaaS repo must maintain a compatible `packages/contracts/` package. OSS and SaaS contract shapes must not drift silently. Both repos should include contract tests that validate schema compatibility. Once the contract package stabilizes, consider publishing it as an internal package consumed by both repos.

---

## Database Schemas

### OSS Schema (SQLite via Drizzle)

```typescript
// server/src/db/schema.ts — OSS

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const owner = sqliteTable('owner', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  displayName: text('display_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  timezone: text('timezone').notNull().default('UTC'),
  passwordHash: text('password_hash').notNull(),
  totpSecret: text('totp_secret_encrypted'),    // encrypted at rest
  totpEnabled: integer('totp_enabled', { mode: 'boolean' }).default(false),
  setupComplete: integer('setup_complete', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  ownerId: integer('owner_id').notNull().references(() => owner.id),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const estateItems = sqliteTable('estate_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  category: text('category').notNull(),          // Financial, Real Estate, etc. (plaintext for filtering)
  title: text('title').notNull(),                // user-facing label (plaintext for listing)
  institutionNameEncrypted: text('institution_name_encrypted'), // encrypted
  accountTypeEncrypted: text('account_type_encrypted'),         // encrypted
  referenceHintEncrypted: text('reference_hint_encrypted'),     // encrypted
  assetDescriptionEncrypted: text('asset_description_encrypted'), // encrypted
  locationNotesEncrypted: text('location_notes_encrypted'),       // encrypted
  executorNotesEncrypted: text('executor_notes_encrypted'),       // encrypted
  sensitiveFlag: integer('sensitive_flag', { mode: 'boolean' }).default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const contacts = sqliteTable('contacts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fullNameEncrypted: text('full_name_encrypted').notNull(),    // encrypted
  relationshipEncrypted: text('relationship_encrypted'),       // encrypted
  priorityOrder: integer('priority_order').notNull(),          // plaintext (for sorting)
  emailEncrypted: text('email_encrypted').notNull(),           // encrypted
  phoneEncrypted: text('phone_encrypted'),                     // encrypted
  telegramHandleEncrypted: text('telegram_handle_encrypted'),  // encrypted
  preferredChannels: text('preferred_channels'),   // JSON array (operational)
  confirmationWindowHours: integer('confirmation_window_hours').notNull().default(48),
  claimPinHash: text('claim_pin_hash'),            // hashed
  backupNotesEncrypted: text('backup_notes_encrypted'),    // encrypted
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const switches = sqliteTable('switches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  mode: text('mode').notNull(),                   // 'trip' | 'heartbeat'
  deploymentMode: text('deployment_mode').notNull(), // 'vault' | 'dead_drop' | 'relay_monitoring' | 'relay_escrow'
  status: text('status').notNull().default('draft'),
    // draft | armed | warning | triggered | cascade_active | completed | cancelled | paused | failed
  triggerAt: integer('trigger_at', { mode: 'timestamp' }),
  heartbeatIntervalDays: integer('heartbeat_interval_days'),
  nextCheckInDueAt: integer('next_check_in_due_at', { mode: 'timestamp' }),
  warningStartsAt: integer('warning_starts_at', { mode: 'timestamp' }),
  gracePeriodHours: integer('grace_period_hours').notNull().default(72),
  warningWindowDays: integer('warning_window_days').notNull().default(3),
  lastCheckInAt: integer('last_check_in_at', { mode: 'timestamp' }),
  lastPacketSyncAt: integer('last_packet_sync_at', { mode: 'timestamp' }),
  selectedContactIds: text('selected_contact_ids'), // JSON array of contact IDs
  selectedEstateItemIds: text('selected_estate_item_ids'), // JSON array
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const packets = sqliteTable('packets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  switchId: integer('switch_id').notNull().references(() => switches.id),
  version: integer('version').notNull(),
  encryptionAlgorithm: text('encryption_algorithm').notNull().default('aes-256-gcm'),
  keyId: text('key_id').notNull(),                // reference to key material
  contentHash: text('content_hash').notNull(),     // hash of plaintext
  encryptedObjectHash: text('encrypted_object_hash'), // hash of ciphertext
  storageProvider: text('storage_provider'),
  storageBucket: text('storage_bucket'),
  storageObjectKey: text('storage_object_key'),
  storageRegion: text('storage_region'),
  presignedUrlStatus: text('presigned_url_status'),
  deletionStatus: text('deletion_status'),
  lastVerifiedAt: integer('last_verified_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const contactClaims = sqliteTable('contact_claims', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  switchId: integer('switch_id').notNull().references(() => switches.id),
  packetId: integer('packet_id').notNull().references(() => packets.id),
  contactId: integer('contact_id').notNull().references(() => contacts.id),
  claimToken: text('claim_token').notNull().unique(),
  status: text('status').notNull().default('pending'),
    // pending | notified | opened | verified | accepted | packet_downloaded | key_viewed | acknowledged | expired | escalated | failed
  notifiedAt: integer('notified_at', { mode: 'timestamp' }),
  openedAt: integer('opened_at', { mode: 'timestamp' }),
  verifiedAt: integer('verified_at', { mode: 'timestamp' }),
  acceptedAt: integer('accepted_at', { mode: 'timestamp' }),
  packetDownloadedAt: integer('packet_downloaded_at', { mode: 'timestamp' }),
  keyViewedAt: integer('key_viewed_at', { mode: 'timestamp' }),
  acknowledgedAt: integer('acknowledged_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  escalatedAt: integer('escalated_at', { mode: 'timestamp' }),
  failedAt: integer('failed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const auditEvents = sqliteTable('audit_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  switchId: integer('switch_id').references(() => switches.id),
  eventType: text('event_type').notNull(),
  actorType: text('actor_type').notNull(),        // 'owner' | 'system' | 'contact' | 'relay'
  actorId: text('actor_id'),
  metadata: text('metadata'),                     // JSON
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value_encrypted').notNull(),        // encrypted JSON
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const encryptionKeys = sqliteTable('encryption_keys', {
  id: text('id').primaryKey(),                     // UUID
  purpose: text('purpose').notNull(),              // 'packet' | 'field'
  keyMaterial: text('key_material_encrypted').notNull(), // encrypted with master key
  algorithm: text('algorithm').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  rotatedAt: integer('rotated_at', { mode: 'timestamp' }),
  // Key material encrypted with master key; Shamir deferred to post-alpha
});

export const releaseRuns = sqliteTable('release_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  triggeringSwitchId: integer('triggering_switch_id').notNull().references(() => switches.id),
  status: text('status').notNull().default('active'),
  activePacketId: integer('active_packet_id').references(() => packets.id),
  currentContactClaimId: integer('current_contact_claim_id').references(() => contactClaims.id),
  suppressedSwitchIds: text('suppressed_switch_ids').notNull().default('[]'),
  metadata: text('metadata'),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  cancelledAt: integer('cancelled_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const localAcknowledgements = sqliteTable('local_acknowledgements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  mode: text('mode').notNull(),
  version: text('version').notNull(),
  acceptedAt: integer('accepted_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
```

### SaaS Schema (PostgreSQL — additional tables beyond similar domain tables)

```typescript
// server/src/db/schema.ts — SaaS (key differences from OSS)

import { pgTable, text, integer, timestamp, boolean, jsonb, serial, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  emailVerified: boolean('email_verified').default(false),
  emailVerifyToken: text('email_verify_token'),
  passwordResetToken: text('password_reset_token'),
  passwordResetExpiresAt: timestamp('password_reset_expires_at'),
  totpSecret: text('totp_secret_encrypted'),
  totpEnabled: boolean('totp_enabled').default(false),
  timezone: text('timezone').notNull().default('UTC'),
  phone: text('phone'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  stripeCustomerId: text('stripe_customer_id').notNull(),
  stripeSubscriptionId: text('stripe_subscription_id'),
  plan: text('plan').notNull(),                   // 'relay' | 'hosted'
  status: text('status').notNull().default('active'),
    // active | past_due | cancelled | trialing | paused
  currentPeriodEnd: timestamp('current_period_end'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const relayConnections = pgTable('relay_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  apiKey: text('api_key_hash').notNull(),          // hashed
  label: text('label'),                            // "Home Server", "VPS", etc.
  lastHeartbeatAt: timestamp('last_heartbeat_at'),
  lastHeartbeatData: jsonb('last_heartbeat_data'), // switch status, version, health
  offlineAlertSentAt: timestamp('offline_alert_sent_at'),
  status: text('status').notNull().default('active'), // active | offline | disconnected
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const stripeWebhookEvents = pgTable('stripe_webhook_events', {
  id: text('id').primaryKey(),                     // Stripe event ID for idempotency
  type: text('type').notNull(),
  processedAt: timestamp('processed_at').notNull().defaultNow(),
});

// Estate items, contacts, switches, packets, claims, audit_events
// Same domain structure as OSS but:
// - Use uuid PKs instead of integer autoincrement
// - Add userId foreign key to every table
// - Use pgTable instead of sqliteTable
// - Use timestamp instead of integer timestamps
// - Use jsonb instead of text for JSON columns
//
// Additional SaaS tables: release_runs, trust_acknowledgements
// (see SaaS Phase 1 schema for full definitions)
```

---

## Security Baseline (Required Phase 1)

All implementations MUST include from day one:

1. **CORS:** Explicit origin allowlist. No `origin: true` with `credentials: true`. No wildcard CORS with credentials.
2. **CSRF:** Implement `GET /api/csrf` endpoint. Server issues a signed CSRF token tied to the session. Client stores the token in memory. All POST, PUT, PATCH, and DELETE requests must include an `X-CSRF-Token` header. Server rejects missing or invalid CSRF tokens. Tests must cover missing, invalid, expired, and valid CSRF token scenarios. Both OSS and SaaS must implement this.
3. **Cookies:** HttpOnly, Secure (production), SameSite=Lax or SameSite=Strict. Explicit CORS allowlist.
4. **Rate limiting:** Login, setup, reset, check-in, claim endpoints.
5. **Default secret rejection:** Server refuses to start if secrets contain "change-me" or < 32 chars.
6. **Password reset (SaaS):** Tokens stored as SHA-256 hash. Single-use. 15-minute expiry.
7. **Field encryption:** All sensitive estate and contact fields encrypted (see expanded schema above).
8. **Audit log redaction:** No plaintext institution names, contact details, or packet contents in audit metadata. See Audit Log Redaction section below.
9. **Reauthentication:** Required for sensitive actions (view keys, change contacts, change triggers, connect relay).

### CSRF Implementation Details

Both OSS and SaaS must implement the following CSRF flow:

- `GET /api/csrf` returns a signed CSRF token tied to the current session.
- Client stores the CSRF token in memory (not localStorage).
- All state-changing requests (POST, PUT, PATCH, DELETE) include `X-CSRF-Token` header.
- Server validates the token on every state-changing request; rejects if missing, invalid, or expired.
- Frontend API client pattern:
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
- Required test coverage: missing token (reject), invalid token (reject), expired token (reject), valid token (accept).

### Audit Log Redaction

Audit events must not leak sensitive data. This applies to both OSS and SaaS.

Audit events should include:
- event type, actor type, actor ID/reference
- switch ID, release run ID, packet ID
- timestamp, status
- non-sensitive operational metadata

Audit events must NOT include:
- institution names, account numbers
- contact names, contact emails, contact phone numbers
- packet plaintext, executor notes
- release key material, storage credentials, API keys

If metadata is necessary for an audit event, store redacted or hashed versions. Example of a correct audit event:

```json
{
  "eventType": "contact_notified",
  "actorType": "system",
  "contactId": "contact_123",
  "channel": "email",
  "deliveryStatus": "queued"
}
```

Never log actual contact details (email addresses, phone numbers, names) in audit metadata.

## Release Run Constraint

Multiple switches may be armed simultaneously, but only ONE active release run may exist per owner at a time.

If a second switch triggers during an active release:
- Attach events to the existing release run, OR
- Queue the second trigger and log the reason.
- NEVER start parallel cascades to the same contacts.

This prevents: contradictory notifications, packet conflicts, and confused contacts.

---

## Phase Schedule

> **Note:** Phase labels are sequencing guidance, not fixed delivery estimates. Optimize for correctness, security, and coherent architecture over calendar estimates.

### Phase 1: Foundation (Both Repos)

**OSS Repo:**
- [ ] Project scaffold: package.json, tsconfig, Dockerfile, docker-compose.yml
- [ ] Fastify server with health check
- [ ] Drizzle + SQLite schema + migrations
- [ ] Auth: owner setup, login, sessions, optional TOTP
- [ ] Estate item CRUD (API + tests)
- [ ] Contact CRUD with ordering (API + tests)
- [ ] React/Vite frontend scaffold
- [ ] API client + basic routing
- [ ] Docker build working end-to-end

**SaaS Repo:**
- [ ] Project scaffold: package.json, tsconfig, docker-compose (Postgres)
- [ ] Fastify server with health check
- [ ] Drizzle + PostgreSQL schema + migrations
- [ ] Auth: register, login, email verify, password reset, sessions
- [ ] Stripe: plans, checkout, webhook, subscription lifecycle
- [ ] Public pricing API endpoint
- [ ] React/Vite frontend scaffold
- [ ] Auth pages: register, login, reset
- [ ] Docker Compose dev environment working
- [ ] DeadDrop contract package (packages/contracts/) compatible with OSS

**Detailed plans:** See `2026-05-06-aegis-oss-phase1.md` and `2026-05-06-aegis-dms-site-phase1.md`

### Phase 2: Core Domain Logic

**OSS Repo:**
- [ ] Switch state machine (trip + heartbeat modes)
- [ ] Switch CRUD API + arm/pause/cancel/check-in
- [ ] Notification system: SMTP email dispatch
- [ ] Notification system: Telegram bot dispatch
- [ ] Reminder scheduling logic
- [ ] Warning mode transitions
- [ ] Worker polling loop (basic — evaluates switches, sends reminders)
- [ ] Dashboard page with live countdown
- [ ] Trigger settings page
- [ ] Switch management UI

**SaaS Repo:**
- [ ] Relay API: accept heartbeats, store connection state
- [ ] Relay monitor: detect offline, send alerts
- [ ] Hosted estate/contacts/switches CRUD (same domain, user-scoped)
- [ ] Marketing landing page (port existing design)
- [ ] Pricing page with live Stripe prices
- [ ] Billing management (Stripe customer portal)
- [ ] App dashboard for hosted users

### Phase 3: Encryption, Packets, Cascade

**OSS Repo:**
- [ ] Crypto service: AES-256-GCM encrypt/decrypt
- [ ] Crypto service: key derivation from passphrase
- [ ] Crypto service: key generation, rotation, destruction lifecycle
- [ ] Field encryption for sensitive DB columns
- [ ] Packet builder: assemble estate items into JSON, encrypt
- [ ] S3-compatible storage: upload, verify, delete, rotate
- [ ] Dead drop sync logic in worker
- [ ] Contact cascade: notify → verify → accept → download → key → acknowledge
- [ ] Claim portal pages (separate clean UI)
- [ ] Escalation logic + timeout handling
- [ ] Release mode page
- [ ] Audit log writing + display

**SaaS Repo:**
- [ ] Managed storage: R2/S3 per-user buckets or prefixes
- [ ] Hosted notification dispatch (Postmark + Telegram)
- [ ] Hosted switch engine + worker
- [ ] Hosted cascade + claim portal
- [ ] Relay-assisted cascade (when OSS instance offline)
- [ ] Relay escrow key model (explicit trust, no premature Shamir)
- [ ] Admin dashboard: user list, metrics

### Phase 4: Productization and Deployment

**OSS Repo:**
- [ ] Setup wizard (first-run web UI)
- [ ] setup.sh interactive script
- [ ] Settings page: notifications, storage, relay connection
- [ ] Deployment mode page
- [ ] Health dashboard (provider status checks)
- [ ] Test mode (simulate full cascade without real notifications)
- [ ] Reliability warnings per deployment mode
- [ ] .env.example with all options documented
- [ ] README with setup instructions
- [ ] Threat model doc
- [ ] E2E test: full heartbeat → miss → cascade flow
- [ ] Docker image optimization
- [ ] GitHub repo setup + AGPL license

**SaaS Repo:**
- [ ] Cancellation/grace period logic
- [ ] Email templates (Postmark)
- [ ] Contact claim email design (clean, professional)
- [ ] Relay connection UI in OSS (link to SaaS)
- [ ] Railway deployment config
- [ ] Environment variables for Railway
- [ ] Domain setup (aegisdms.life)
- [ ] SSL/DNS configuration
- [ ] E2E test: register → subscribe → create switch → cascade
- [ ] Security review
- [ ] Privacy policy / ToS pages

---

## Subsystem Dependencies

```
OSS:
  Foundation → Auth → Estate CRUD → Contact CRUD
                                         ↓
  Switch Engine ← depends on → Contacts + Estate Items
       ↓
  Notifications (SMTP + Telegram)
       ↓
  Worker (polling loop) ← depends on → Switch Engine + Notifications
       ↓
  Crypto → Packet Builder → Storage (S3)
       ↓                        ↓
  Dead Drop Sync ←──────────────┘
       ↓
  Contact Cascade → Claim Portal
       ↓
  Relay Connector (optional, calls SaaS API)

SaaS:
  Foundation → Auth → Stripe Billing
       ↓                    ↓
  Relay API ← depends on → Subscriptions
       ↓
  Relay Monitor → Offline Alerts
       ↓
  Hosted Domain Logic (Estate + Contacts + Switches)
       ↓
  Hosted Worker + Cascade + Claim Portal
       ↓
  Marketing Site + Pricing API
```

---

## Key Integration Points

### 1. OSS → SaaS: Relay Connection

```
OSS sends:
  POST https://aegisdms.life/api/relay/heartbeat
  Authorization: Bearer <relay-api-key>
  Body: {
    switchId: string,
    status: 'armed' | 'warning' | 'triggered' | ...,
    lastCheckInAt: ISO timestamp,
    nextCheckInDueAt: ISO timestamp,
    packetVersion: number,
    packetHash: string,
    appVersion: string,
    health: { db: 'ok', storage: 'ok' | 'error', notifications: 'ok' | 'error' }
  }

SaaS responds:
  200 OK { received: true, serverTime: ISO timestamp }
```

### 2. OSS → SaaS: Pricing API

```
OSS fetches:
  GET https://aegisdms.life/api/pricing
  No auth required (public endpoint)

SaaS responds:
  200 OK {
    plans: [
      { id: 'relay', name: 'Aegis Relay', price: <from Stripe or env>, currency: 'usd', interval: 'month', features: [...] },
      { id: 'hosted', name: 'Aegis Hosted', price: <from Stripe or env>, currency: 'usd', interval: 'month', features: [...] }
    ]
  }
```

**Pricing approach:**
- Alpha: env-configured fallback display prices (AEGIS_RELAY_DISPLAY_PRICE, AEGIS_HOSTED_DISPLAY_PRICE).
- Post-alpha: read Stripe Price objects via STRIPE_RELAY_PRICE_ID, STRIPE_HOSTED_PRICE_ID.
- If Stripe unavailable: return plan names/features with price: null, plus link to pricing page.
- OSS: if pricing API fails, hide exact prices and show link to SaaS pricing page.

### 3. OSS → SaaS: Relay Registration (Auth Code Exchange)

**SECURITY: API keys MUST NOT be passed in URL query strings.** Use authorization code exchange:

```
1. User clicks "Connect to Relay" in OSS dashboard.
2. OSS generates relay_link_nonce + state, stores in appSettings.
3. OSS opens: https://aegisdms.life/relay/connect?callback=<oss-url>&state=<state>
4. User creates SaaS account or logs in on SaaS.
5. SaaS generates short-lived link code (5-minute expiry, single-use).
6. SaaS redirects to: <oss-url>/api/relay/callback?code=<link-code>&state=<state>
   NOTE: Only code + state in URL. No API key.
7. OSS backend validates state, then exchanges code server-to-server:
   POST https://aegisdms.life/api/relay/exchange
   Body: { code, callbackUrl }
   Response: { apiKey, relayEndpoint }
8. OSS stores API key encrypted in appSettings.
9. SaaS stores only API key hash in relay_connections table.
```

Requirements:
- Code expires in 5 minutes.
- Code is single-use (consumed on exchange).
- State parameter validated to prevent CSRF.
- No open redirects (callback URL must match registered value).
- Manual confirmation of callback URL on first link.

---

## Critical Design Decisions Reference

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | TypeScript everywhere | Solo dev, shared types, one mental model |
| OSS Backend | Fastify | Modern, typed, plugin system, auto-docs |
| OSS Database | SQLite via better-sqlite3 | Zero config, single file, Docker-friendly |
| SaaS Database | PostgreSQL | Multi-user, scalable, Railway managed |
| ORM | Drizzle | TypeScript-native, supports both SQLite + PG |
| Frontend | React + Vite + Tailwind | Fast builds, SPA for dashboard |
| Auth | Custom (Argon2 + sessions + TOTP) | Full control, no vendor dependency |
| Billing | Stripe | Industry standard, Eric knows it |
| Email | Postmark (SaaS), SMTP (OSS) | Reliable transactional email |
| Encryption | AES-256-GCM via Node crypto | Built-in, no extra dependencies |
| Key splitting | v1: Local key release (OSS), Relay escrow (paid) | Honest about trust model; Shamir deferred to post-alpha |
| Packet storage | S3-compatible (user-configured OSS, managed SaaS) | Universal, many providers |
| Worker | DB polling loop (30-60s) | Simple, reliable, no Redis needed |
| OSS License | AGPL-3.0 | Protects commercial offering, allows self-hosting |
| Deployment (OSS) | Docker Compose | Self-hoster standard |
| Deployment (SaaS) | Railway | Eric's existing platform, AWS under hood |
| Domain | aegisdms.life | .life TLD fits product theme |
| GitHub | aegis-dms org | Professional, separates from personal |

---

## Future Platform Layer: DeadDrop API

DeadDrop API is the future infrastructure/platform layer behind Aegis.

It is not a replacement for Aegis Core, Aegis Relay, or Aegis Hosted.

Aegis Core, Aegis Relay, and Aegis Hosted should be built as real products. At the same time, the packet, heartbeat, release-run, claim-event, webhook, storage, and notification contracts should be designed as if they may later become public partner APIs.

The goal is to avoid building Aegis as a narrow one-off dead man's switch. Instead, the architecture should support a future where third-party apps can embed Aegis-style encrypted legacy release and emergency access workflows using DeadDrop API.

### Future Platform Entities (SaaS Roadmap)

These inform architecture now but do not block Phase 1:

```
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

### Future API/SDK Deliverables

```
OpenAPI spec
TypeScript SDK
Webhook signing
Example partner integration
Partner dashboard
Usage/metering dashboard
API docs
```

---

## Key Management

### Alpha Key Model

No Shamir Secret Sharing for alpha. No "zero knowledge" claims unless fully designed and proven.

| Mode | Key Model | Privacy | Resilience |
|------|-----------|---------|------------|
| Vault / Dead Drop | Local key release only | Highest | Low — local host lost = no automated release |
| Relay Monitoring | Local key release; SaaS tracks heartbeats and alerts | High | Medium — SaaS detects offline but cannot release |
| Relay Escrow | User authorizes SaaS to hold release material under configured policy | Medium — requires trust in Aegis SaaS | High — SaaS can execute release if host offline |
| Hosted | Server-side encryption, server-managed release | Requires trust in Aegis SaaS | Highest |

Future: client-side encryption, contact public-key encryption, Shamir threshold schemes. See `docs/key-management.md` (to be created).

---

## Phase Plans

Detailed phase plans with full TDD task breakdowns:

1. `2026-05-06-aegis-oss-phase1.md` — OSS Foundation (Phase 1)
2. `2026-05-06-aegis-dms-site-phase1.md` — SaaS Foundation (Phase 1)
3. Phase 2-4 plans written as Phase 1 completes

---
