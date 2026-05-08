# Aegis DMS Site — Phase 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the commercial Aegis DMS Site repo with a working Fastify + PostgreSQL + React/Vite stack, multi-user auth (register, login, email verify, password reset), Stripe billing (checkout, webhooks, subscription lifecycle), a public pricing API endpoint, and Docker Compose dev environment — all with tests.

**Architecture:** Monorepo with `server/` (Fastify + Drizzle + PostgreSQL) and `web/` (React + Vite + Tailwind) workspaces plus `packages/shared/` for types. Multi-user auth with Argon2id passwords, DB-backed sessions, email verification via Postmark, password reset flow. Stripe handles billing — checkout sessions, customer portal, webhook events. Public `/api/pricing` endpoint consumed by OSS app. Docker Compose runs Postgres locally for dev.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, PostgreSQL (via `postgres` driver), React 18, Vite, Tailwind CSS, Vitest, Argon2, Stripe, Postmark, Docker.

**Parent plan:** `2026-05-06-aegis-master-plan.md`

**Target repo:** New repo — will be initialized as `aegis-dms-site/` in a directory chosen at execution time.

---

## Pre-requisites

Before starting, the engineer needs:
- Node.js 20+ installed
- Docker + Docker Compose installed (for local Postgres)
- A Stripe account with test API keys (publishable + secret)
- A Postmark account with a server API token (or use test mode — emails won't actually send in dev)

---

## Task 1: Initialize Project Structure

**Files:**
- Create: `package.json` (workspace root)
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`

- [ ] **Step 1: Create root workspace package.json**

```json
{
  "name": "aegis-dms-site",
  "private": true,
  "workspaces": ["server", "web", "packages/*"],
  "scripts": {
    "dev": "npm run dev --workspace=server & npm run dev --workspace=web",
    "build": "npm run build --workspace=web && npm run build --workspace=server",
    "test": "npm run test --workspace=server",
    "db:generate": "npm run db:generate --workspace=server",
    "db:migrate": "npm run db:migrate --workspace=server"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
.env
.DS_Store
```

- [ ] **Step 4: Create .env.example**

```bash
# Aegis DMS Site Configuration
AEGIS_PORT=8001
AEGIS_HOST=0.0.0.0
AEGIS_SECRET_KEY=change-me-to-a-random-64-char-string
AEGIS_FIELD_ENCRYPTION_KEY=change-me-to-a-random-32-byte-hex
AEGIS_BASE_URL=http://localhost:8001

# PostgreSQL
DATABASE_URL=postgresql://aegis:aegis@localhost:5432/aegis_site

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_RELAY_PRICE_ID=price_xxx
STRIPE_HOSTED_PRICE_ID=price_xxx

# Postmark
POSTMARK_API_TOKEN=xxx
POSTMARK_FROM_EMAIL=noreply@aegisdms.life

# Telegram (shared bot)
TELEGRAM_BOT_TOKEN=
```

- [ ] **Step 5: Create packages/shared/package.json**

```json
{
  "name": "@aegis-site/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/types.ts",
  "types": "./src/types.ts"
}
```

- [ ] **Step 6: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 7: Create packages/shared/src/types.ts**

```typescript
export type SubscriptionPlan = 'relay' | 'hosted';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing' | 'paused';

export type RelayConnectionStatus = 'active' | 'offline' | 'disconnected';

export type SwitchMode = 'trip' | 'heartbeat';
export type SwitchStatus =
  | 'draft' | 'armed' | 'warning' | 'triggered'
  | 'cascade_active' | 'completed' | 'cancelled' | 'paused' | 'failed';

export type ClaimStatus =
  | 'pending' | 'notified' | 'opened' | 'verified' | 'accepted'
  | 'packet_downloaded' | 'key_viewed' | 'acknowledged'
  | 'expired' | 'escalated' | 'failed';

export type EstateCategory =
  | 'Financial' | 'Real Estate' | 'Digital Assets'
  | 'Vehicles' | 'Insurance' | 'Documents' | 'Instructions';

export type NotificationChannel = 'email' | 'sms' | 'telegram';

export interface PricingPlan {
  id: SubscriptionPlan;
  name: string;
  price: number | null;
  currency: string;
  interval: 'month';
  features: string[];
  pricingUrl?: string;
}

export interface PricingResponse {
  plans: PricingPlan[];
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  timezone: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
}

export interface RelayConnection {
  id: string;
  label: string | null;
  lastHeartbeatAt: string | null;
  status: RelayConnectionStatus;
  createdAt: string;
}
```

- [ ] **Step 8: Create server/package.json**

```json
{
  "name": "@aegis-site/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts"
  },
  "dependencies": {
    "@aegis-site/shared": "*",
    "fastify": "^5.2.0",
    "@fastify/cookie": "^11.0.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/static": "^8.0.0",
    "@fastify/formbody": "^8.0.0",
    "drizzle-orm": "^0.38.0",
    "postgres": "^3.4.0",
    "argon2": "^0.41.0",
    "dotenv": "^16.4.0",
    "nanoid": "^5.0.0",
    "zod": "^3.24.0",
    "stripe": "^17.0.0",
    "postmark": "^4.0.0",
    "fastify-plugin": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "drizzle-kit": "^0.30.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 9: Create server/tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "references": [{ "path": "../packages/shared" }]
}
```

- [ ] **Step 10: Create web/package.json**

```json
{
  "name": "@aegis-site/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@aegis-site/shared": "*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 11: Create web/tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "./dist",
    "noEmit": true
  },
  "include": ["src"],
  "references": [{ "path": "../packages/shared" }]
}
```

- [ ] **Step 12: Run npm install and verify workspace links**

Run: `npm install`
Expected: Clean install with workspace symlinks for `@aegis-site/shared`

- [ ] **Step 13: Commit**

```bash
git init
git add -A
git commit -m "chore: initialize saas project structure with workspaces"
```

---

## Task 1B: DeadDrop Contract Package Compatibility

**Goal:** Create `packages/contracts/` as the canonical domain boundary package in the SaaS repo. Must stay compatible with OSS contracts to prevent early drift.

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/packet-envelope.ts`
- Create: `packages/contracts/src/release-run.ts`
- Create: `packages/contracts/src/heartbeat.ts`
- Create: `packages/contracts/src/claim-event.ts`
- Create: `packages/contracts/src/webhook-event.ts`
- Create: `packages/contracts/src/storage-provider.ts`
- Create: `packages/contracts/src/notification-provider.ts`
- Create: `packages/contracts/tests/contracts.test.ts`

**Requirements:**
- Match OSS contract package structure and schemas
- Use versioned `zod` schemas
- Export TypeScript types
- Validate packet/release/heartbeat/claim/webhook structures
- Include contract tests
- Fail tests if required contract fields drift from OSS

> **Note:** Eventually OSS and SaaS may consume the same published contracts package. For now, duplicated packages are acceptable but must not drift silently.

---

## Task 2: Docker Compose Dev Environment (PostgreSQL)

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create docker-compose.yml for local Postgres**

Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: aegis
      POSTGRES_PASSWORD: aegis
      POSTGRES_DB: aegis_site
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 2: Start Postgres**

Run: `docker compose up -d`
Expected: Postgres container running on port 5432

- [ ] **Step 3: Verify connection**

Run: `docker compose exec postgres psql -U aegis -d aegis_site -c "SELECT 1"`
Expected: Returns `1`

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: docker compose with postgresql for local dev"
```

---

## Task 3: Fastify Server + Health Check

**Files:**
- Create: `server/src/index.ts`
- Create: `server/src/config.ts`
- Create: `server/src/routes/health.ts`
- Test: `server/tests/health.test.ts`

- [ ] **Step 1: Write the health check test**

Create `server/tests/health.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/index.js';

describe('GET /health', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
    expect(body.version).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/health.test.ts`
Expected: FAIL — `buildApp` not found

- [ ] **Step 3: Create config.ts**

Create `server/src/config.ts`:

```typescript
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';

loadDotenv({ path: resolve(process.cwd(), '../.env') });

export interface AppConfig {
  port: number;
  host: string;
  databaseUrl: string;
  secretKey: string;
  fieldEncryptionKey: string;
  baseUrl: string;
  stripe: {
    secretKey: string;
    publishableKey: string;
    webhookSecret: string;
    relayPriceId: string;
    hostedPriceId: string;
  };
  postmark: {
    apiToken: string;
    fromEmail: string;
  };
  testing: boolean;
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const config = {
    port: parseInt(process.env.AEGIS_PORT || '8001', 10),
    host: process.env.AEGIS_HOST || '0.0.0.0',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://aegis:aegis@localhost:5432/aegis_site',
    secretKey: process.env.AEGIS_SECRET_KEY || 'dev-secret-key-change-me',
    fieldEncryptionKey: process.env.AEGIS_FIELD_ENCRYPTION_KEY || 'dev-field-key-change-me-32bytes!!',
    baseUrl: process.env.AEGIS_BASE_URL || 'http://localhost:8001',
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      relayPriceId: process.env.STRIPE_RELAY_PRICE_ID || '',
      hostedPriceId: process.env.STRIPE_HOSTED_PRICE_ID || '',
    },
    postmark: {
      apiToken: process.env.POSTMARK_API_TOKEN || '',
      fromEmail: process.env.POSTMARK_FROM_EMAIL || 'noreply@aegisdms.life',
    },
    testing: false,
    ...overrides,
  };

  // SECURITY: Refuse to start with default secrets in production
  if (!config.testing && process.env.NODE_ENV === 'production') {
    if (config.secretKey.includes('change-me') || config.secretKey.length < 32) {
      throw new Error('FATAL: AEGIS_SECRET_KEY is not set or too short.');
    }
    if (config.fieldEncryptionKey.includes('change-me') || config.fieldEncryptionKey.length < 32) {
      throw new Error('FATAL: AEGIS_FIELD_ENCRYPTION_KEY is not set or too short.');
    }
  }

  return config;
}
```

- [ ] **Step 4: Create health route**

Create `server/src/routes/health.ts`:

```typescript
import type { FastifyInstance } from 'fastify';

const APP_VERSION = '0.1.0';
const startTime = Date.now();

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      version: APP_VERSION,
      uptime: Math.floor((Date.now() - startTime) / 1000),
    });
  });
}
```

- [ ] **Step 5: Create server entry point**

Create `server/src/index.ts`:

```typescript
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import { loadConfig, type AppConfig } from './config.js';
import { healthRoutes } from './routes/health.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
  }
}

export async function buildApp(overrides: Partial<AppConfig> = {}) {
  const config = loadConfig(overrides);
  const app = Fastify({ logger: !config.testing });

  await app.register(cookie, { secret: config.secretKey });
  await app.register(cors, {
    origin: config.testing ? true : config.baseUrl,
    credentials: true,
  });
  await app.register(formbody);

  app.decorate('config', config);

  await app.register(healthRoutes);

  return app;
}

async function start() {
  const app = await buildApp();
  const config = loadConfig();

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`Aegis SaaS server listening on ${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const isMainModule = process.argv[1] && !process.argv[1].includes('vitest');
if (isMainModule) {
  start();
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && npx vitest run tests/health.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/src/index.ts server/src/config.ts server/src/routes/health.ts server/tests/health.test.ts
git commit -m "feat: fastify server with health check endpoint"
```

---

## Task 4: Database Schema + Drizzle Setup

**Files:**
- Create: `server/src/db/schema.ts`
- Create: `server/src/db/index.ts`
- Create: `server/src/db/migrate.ts`
- Create: `server/drizzle.config.ts`

- [ ] **Step 1: Create drizzle.config.ts**

Create `server/drizzle.config.ts`:

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://aegis:aegis@localhost:5432/aegis_site',
  },
});
```

- [ ] **Step 2: Create the full schema**

Create `server/src/db/schema.ts`:

```typescript
import { pgTable, text, timestamp, boolean, jsonb, uuid, integer, serial } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  emailVerifyToken: text('email_verify_token'),
  emailVerifyTokenExpiresAt: timestamp('email_verify_token_expires_at'),
  passwordResetTokenHash: text('password_reset_token_hash'), // SHA-256 hash, NOT plaintext
  passwordResetExpiresAt: timestamp('password_reset_expires_at'),
  totpSecretEncrypted: text('totp_secret_encrypted'),
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  timezone: text('timezone').notNull().default('UTC'),
  phone: text('phone'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id').notNull(),
  stripeSubscriptionId: text('stripe_subscription_id'),
  plan: text('plan').notNull(),
  status: text('status').notNull().default('active'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const relayConnections = pgTable('relay_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  apiKeyHash: text('api_key_hash').notNull(),
  label: text('label'),
  lastHeartbeatAt: timestamp('last_heartbeat_at'),
  lastHeartbeatData: jsonb('last_heartbeat_data'),
  offlineAlertSentAt: timestamp('offline_alert_sent_at'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const stripeWebhookEvents = pgTable('stripe_webhook_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  processedAt: timestamp('processed_at').notNull().defaultNow(),
});

// Domain tables — user-scoped versions of OSS tables

export const estateItems = pgTable('estate_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  title: text('title').notNull(),
  institutionNameEncrypted: text('institution_name_encrypted'),
  accountTypeEncrypted: text('account_type_encrypted'),
  referenceHintEncrypted: text('reference_hint_encrypted'),
  assetDescriptionEncrypted: text('asset_description_encrypted'),
  locationNotesEncrypted: text('location_notes_encrypted'),
  executorNotesEncrypted: text('executor_notes_encrypted'),
  sensitiveFlag: boolean('sensitive_flag').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  fullNameEncrypted: text('full_name_encrypted').notNull(),
  relationshipEncrypted: text('relationship_encrypted'),
  priorityOrder: integer('priority_order').notNull(),
  emailEncrypted: text('email_encrypted').notNull(),
  phoneEncrypted: text('phone_encrypted'),
  telegramHandleEncrypted: text('telegram_handle_encrypted'),
  preferredChannels: jsonb('preferred_channels').notNull().default(['email']),
  confirmationWindowHours: integer('confirmation_window_hours').notNull().default(48),
  claimPinHash: text('claim_pin_hash'),
  backupNotesEncrypted: text('backup_notes_encrypted'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const switches = pgTable('switches', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  mode: text('mode').notNull(),
  status: text('status').notNull().default('draft'),
  triggerAt: timestamp('trigger_at'),
  heartbeatIntervalDays: integer('heartbeat_interval_days'),
  nextCheckInDueAt: timestamp('next_check_in_due_at'),
  warningStartsAt: timestamp('warning_starts_at'),
  gracePeriodHours: integer('grace_period_hours').notNull().default(72),
  warningWindowDays: integer('warning_window_days').notNull().default(3),
  lastCheckInAt: timestamp('last_check_in_at'),
  lastPacketSyncAt: timestamp('last_packet_sync_at'),
  selectedContactIds: jsonb('selected_contact_ids').default([]),
  selectedEstateItemIds: jsonb('selected_estate_item_ids').default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const packets = pgTable('packets', {
  id: uuid('id').primaryKey().defaultRandom(),
  switchId: uuid('switch_id').notNull().references(() => switches.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  encryptionAlgorithm: text('encryption_algorithm').notNull().default('aes-256-gcm'),
  keyId: text('key_id').notNull(),
  contentHash: text('content_hash').notNull(),
  encryptedObjectHash: text('encrypted_object_hash'),
  storageProvider: text('storage_provider'),
  storageBucket: text('storage_bucket'),
  storageObjectKey: text('storage_object_key'),
  storageRegion: text('storage_region'),
  deletionStatus: text('deletion_status'),
  lastVerifiedAt: timestamp('last_verified_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const contactClaims = pgTable('contact_claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  switchId: uuid('switch_id').notNull().references(() => switches.id),
  packetId: uuid('packet_id').notNull().references(() => packets.id),
  contactId: uuid('contact_id').notNull().references(() => contacts.id),
  claimToken: text('claim_token').notNull().unique(),
  status: text('status').notNull().default('pending'),
  notifiedAt: timestamp('notified_at'),
  openedAt: timestamp('opened_at'),
  verifiedAt: timestamp('verified_at'),
  acceptedAt: timestamp('accepted_at'),
  packetDownloadedAt: timestamp('packet_downloaded_at'),
  keyViewedAt: timestamp('key_viewed_at'),
  acknowledgedAt: timestamp('acknowledged_at'),
  expiresAt: timestamp('expires_at').notNull(),
  escalatedAt: timestamp('escalated_at'),
  failedAt: timestamp('failed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const auditEvents = pgTable('audit_events', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  switchId: uuid('switch_id').references(() => switches.id),
  eventType: text('event_type').notNull(),
  actorType: text('actor_type').notNull(),
  actorId: text('actor_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const encryptionKeys = pgTable('encryption_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  purpose: text('purpose').notNull(),
  keyMaterialEncrypted: text('key_material_encrypted').notNull(),
  algorithm: text('algorithm').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  rotatedAt: timestamp('rotated_at'),
});

export const releaseRuns = pgTable('release_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  triggeringSwitchId: uuid('triggering_switch_id').notNull().references(() => switches.id),
  status: text('status').notNull().default('active'),
  activePacketId: uuid('active_packet_id').references(() => packets.id),
  currentContactClaimId: uuid('current_contact_claim_id').references(() => contactClaims.id),
  suppressedSwitchIds: jsonb('suppressed_switch_ids').notNull().default([]),
  metadata: jsonb('metadata'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const trustAcknowledgements = pgTable('trust_acknowledgements', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull(),
  version: text('version').notNull(),
  acceptedAt: timestamp('accepted_at').notNull().defaultNow(),
  ipHash: text('ip_hash'),
  userAgentHash: text('user_agent_hash'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

- [ ] **Step 3: Create database connection module**

Create `server/src/db/index.ts`:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

let db: ReturnType<typeof createDb> | null = null;

function createDb(connectionString: string) {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

export function getDb(connectionString?: string): ReturnType<typeof createDb> {
  if (!db) {
    db = createDb(connectionString || 'postgresql://aegis:aegis@localhost:5432/aegis_site');
  }
  return db;
}

export type AegisDb = ReturnType<typeof createDb>;
```

- [ ] **Step 4: Create migration runner**

Create `server/src/db/migrate.ts`:

```typescript
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://aegis:aegis@localhost:5432/aegis_site';
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

await migrate(db, { migrationsFolder: './drizzle' });
console.log('Migrations applied successfully');
await client.end();
```

- [ ] **Step 5: Generate initial migration**

Run: `cd server && npx drizzle-kit generate`
Expected: Migration files created in `server/drizzle/`

- [ ] **Step 6: Apply migration**

Run: `cd server && npx tsx src/db/migrate.ts`
Expected: "Migrations applied successfully"

- [ ] **Step 7: Commit**

```bash
git add server/src/db/ server/drizzle.config.ts server/drizzle/
git commit -m "feat: drizzle schema and postgresql database setup"
```

---

## Task 5: Auth — Password Hashing + Session Management

**Files:**
- Create: `server/src/auth/password.ts`
- Create: `server/src/auth/session.ts`
- Create: `server/src/auth/plugin.ts`
- Test: `server/tests/auth.test.ts`

- [ ] **Step 1: Write auth tests**

Create `server/tests/auth.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password.js';

describe('password hashing', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('test-passphrase-123');
    expect(hash).not.toBe('test-passphrase-123');
    expect(await verifyPassword('test-passphrase-123', hash)).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('correct-password');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/auth.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement password module**

Create `server/src/auth/password.ts`:

```typescript
import argon2 from 'argon2';

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/auth.test.ts`
Expected: PASS

- [ ] **Step 5: Implement session management**

Create `server/src/auth/session.ts`:

```typescript
import { nanoid } from 'nanoid';
import { eq, lt } from 'drizzle-orm';
import { sessions } from '../db/schema.js';
import type { AegisDb } from '../db/index.js';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for SaaS

export async function createSession(db: AegisDb, userId: string): Promise<string> {
  const id = nanoid(48);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  await db.insert(sessions).values({
    id,
    userId,
    expiresAt,
    createdAt: now,
  });

  return id;
}

export async function validateSession(db: AegisDb, sessionId: string): Promise<string | null> {
  const [result] = await db.select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!result) return null;
  if (result.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  return result.userId;
}

export async function deleteSession(db: AegisDb, sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function cleanExpiredSessions(db: AegisDb): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
```

- [ ] **Step 6: Implement auth plugin for Fastify**

Create `server/src/auth/plugin.ts`:

```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { validateSession } from './session.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

async function authPlugin(app: FastifyInstance) {
  app.decorateRequest('userId', undefined);

  app.decorate('requireAuth', async function (req: FastifyRequest, reply: FastifyReply) {
    const sessionId = req.cookies?.aegis_session;
    if (!sessionId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const userId = await validateSession(app.db, sessionId);
    if (!userId) {
      return reply.status(401).send({ error: 'Session expired' });
    }

    req.userId = userId;
  });
}

export default fp(authPlugin, { name: 'aegis-auth' });
```

- [ ] **Step 7: Commit**

```bash
git add server/src/auth/ server/tests/auth.test.ts
git commit -m "feat: auth system with argon2 password hashing and session management"
```

---

## Task 6: Email Service (Postmark)

**Files:**
- Create: `server/src/services/email.ts`
- Test: `server/tests/email.test.ts`

- [ ] **Step 1: Write email service tests**

Create `server/tests/email.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { buildVerifyEmailHtml, buildResetPasswordHtml } from '../src/services/email.js';

describe('email templates', () => {
  it('builds verify email HTML with token link', () => {
    const html = buildVerifyEmailHtml('https://aegisdms.life', 'abc123');
    expect(html).toContain('abc123');
    expect(html).toContain('aegisdms.life');
    expect(html).toContain('verify');
  });

  it('builds reset password HTML with token link', () => {
    const html = buildResetPasswordHtml('https://aegisdms.life', 'reset456');
    expect(html).toContain('reset456');
    expect(html).toContain('aegisdms.life');
    expect(html).toContain('reset');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/email.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement email service**

Create `server/src/services/email.ts`:

```typescript
import { ServerClient } from 'postmark';

let client: ServerClient | null = null;

export function getEmailClient(apiToken: string): ServerClient {
  if (!client) {
    client = new ServerClient(apiToken);
  }
  return client;
}

export function buildVerifyEmailHtml(baseUrl: string, token: string): string {
  const link = `${baseUrl}/verify-email?token=${token}`;
  return `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
      <h1 style="font-size: 24px; color: #0B1C2C;">Verify your Aegis account</h1>
      <p style="color: #4A6B8A; line-height: 1.6;">Click the button below to verify your email address.</p>
      <a href="${link}" style="display: inline-block; background: #0B1C2C; color: #DDE8F4; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">Verify Email</a>
      <p style="color: #8AAAC8; font-size: 12px;">If you didn't create an Aegis account, ignore this email.</p>
    </div>
  `;
}

export function buildResetPasswordHtml(baseUrl: string, token: string): string {
  const link = `${baseUrl}/reset-password?token=${token}`;
  return `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
      <h1 style="font-size: 24px; color: #0B1C2C;">Reset your password</h1>
      <p style="color: #4A6B8A; line-height: 1.6;">Click the button below to reset your Aegis password. This link expires in 1 hour.</p>
      <a href="${link}" style="display: inline-block; background: #0B1C2C; color: #DDE8F4; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">Reset Password</a>
      <p style="color: #8AAAC8; font-size: 12px;">If you didn't request a password reset, ignore this email.</p>
    </div>
  `;
}

export async function sendEmail(
  apiToken: string,
  fromEmail: string,
  to: string,
  subject: string,
  htmlBody: string,
): Promise<void> {
  if (!apiToken) {
    console.log(`[email-stub] To: ${to}, Subject: ${subject}`);
    return;
  }

  const client = getEmailClient(apiToken);
  await client.sendEmail({
    From: fromEmail,
    To: to,
    Subject: subject,
    HtmlBody: htmlBody,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/email.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/services/email.ts server/tests/email.test.ts
git commit -m "feat: postmark email service with verify and reset templates"
```

---

## Task 7: Auth Routes — Register, Login, Email Verify, Password Reset

**Files:**
- Create: `server/src/routes/auth.ts`
- Modify: `server/src/index.ts` (register routes + db + auth plugin)
- Test: `server/tests/auth-routes.test.ts`

- [ ] **Step 1: Write auth routes tests**

Create `server/tests/auth-routes.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/index.js';

describe('Auth routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('creates a new user account', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          displayName: 'Test User',
          email: 'test@example.com',
          password: 'secure-passphrase-123',
          timezone: 'America/Chicago',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.user.displayName).toBe('Test User');
      expect(body.user.email).toBe('test@example.com');
      expect(body.user.emailVerified).toBe(false);
    });

    it('rejects duplicate email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          displayName: 'Another User',
          email: 'test@example.com',
          password: 'another-password-123',
          timezone: 'UTC',
        },
      });
      expect(res.statusCode).toBe(409);
    });

    it('rejects weak password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          displayName: 'Weak User',
          email: 'weak@example.com',
          password: 'short',
          timezone: 'UTC',
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns session cookie on valid login', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'secure-passphrase-123',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['set-cookie']).toBeDefined();
      const cookies = String(res.headers['set-cookie']);
      expect(cookies).toContain('aegis_session');
    });

    it('rejects invalid password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'wrong-password',
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects non-existent email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'nobody@example.com',
          password: 'some-password-123',
        },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns user info when authenticated', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com', password: 'secure-passphrase-123' },
      });
      const cookies = String(loginRes.headers['set-cookie']);

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: cookies },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.displayName).toBe('Test User');
    });

    it('returns 401 without session', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears session', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com', password: 'secure-passphrase-123' },
      });
      const cookies = String(loginRes.headers['set-cookie']);

      const logoutRes = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { cookie: cookies },
      });
      expect(logoutRes.statusCode).toBe(200);

      const meRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: cookies },
      });
      expect(meRes.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/request-reset', () => {
    it('accepts valid email without revealing existence', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/request-reset',
        payload: { email: 'test@example.com' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('accepts non-existent email without revealing existence', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/request-reset',
        payload: { email: 'ghost@example.com' },
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/auth-routes.test.ts`
Expected: FAIL

- [ ] **Step 3: Create auth routes**

Create `server/src/routes/auth.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { createSession, deleteSession } from '../auth/session.js';
import { sendEmail, buildVerifyEmailHtml, buildResetPasswordHtml } from '../services/email.js';

const registerSchema = z.object({
  displayName: z.string().min(1).max(200),
  email: z.string().email().max(320),
  password: z.string().min(8).max(256),
  timezone: z.string().default('UTC'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const requestResetSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(256),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  // Register
  app.post('/api/auth/register', async (req, reply) => {
    const body = registerSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input', details: body.error.flatten() });
    }

    const { displayName, email, password, timezone } = body.data;

    const [existing] = await app.db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(password);
    const emailVerifyToken = nanoid(32);
    const emailVerifyTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [created] = await app.db.insert(users).values({
      displayName,
      email: email.toLowerCase(),
      passwordHash,
      timezone,
      emailVerifyToken,
      emailVerifyTokenExpiresAt,
    }).returning();

    const sessionId = await createSession(app.db, created.id);

    reply.setCookie('aegis_session', sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 86400,
    });

    // Send verification email (non-blocking)
    sendEmail(
      app.config.postmark.apiToken,
      app.config.postmark.fromEmail,
      created.email,
      'Verify your Aegis account',
      buildVerifyEmailHtml(app.config.baseUrl, emailVerifyToken),
    ).catch(err => app.log.error({ err }, 'Failed to send verification email'));

    return reply.status(201).send({
      user: {
        id: created.id,
        displayName: created.displayName,
        email: created.email,
        emailVerified: created.emailVerified,
        timezone: created.timezone,
        createdAt: created.createdAt.toISOString(),
      },
    });
  });

  // Login
  app.post('/api/auth/login', async (req, reply) => {
    const body = loginSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    const { email, password } = body.data;

    const [user] = await app.db.select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    if (!user) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const sessionId = await createSession(app.db, user.id);

    reply.setCookie('aegis_session', sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 86400,
    });

    return reply.send({
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        emailVerified: user.emailVerified,
        timezone: user.timezone,
      },
    });
  });

  // Get current user
  app.get('/api/auth/me', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const [user] = await app.db.select()
      .from(users)
      .where(eq(users.id, req.userId!));

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      emailVerified: user.emailVerified,
      timezone: user.timezone,
      totpEnabled: user.totpEnabled,
      createdAt: user.createdAt.toISOString(),
    });
  });

  // Logout
  app.post('/api/auth/logout', async (req, reply) => {
    const sessionId = req.cookies?.aegis_session;
    if (sessionId) {
      await deleteSession(app.db, sessionId);
      reply.clearCookie('aegis_session', { path: '/' });
    }
    return reply.send({ success: true });
  });

  // Verify email
  app.post('/api/auth/verify-email', async (req, reply) => {
    const body = verifyEmailSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid token' });
    }

    const [user] = await app.db.select()
      .from(users)
      .where(eq(users.emailVerifyToken, body.data.token));

    if (!user) {
      return reply.status(400).send({ error: 'Invalid or expired token' });
    }

    if (user.emailVerifyTokenExpiresAt && user.emailVerifyTokenExpiresAt < new Date()) {
      return reply.status(400).send({ error: 'Token expired' });
    }

    await app.db.update(users)
      .set({
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return reply.send({ success: true });
  });

  // Request password reset
  app.post('/api/auth/request-reset', async (req, reply) => {
    const body = requestResetSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    // Always return 200 to avoid email enumeration
    const [user] = await app.db.select()
      .from(users)
      .where(eq(users.email, body.data.email.toLowerCase()));

    if (user) {
      const resetToken = nanoid(32);
      const tokenHash = createHash('sha256').update(resetToken).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes (not 1 hour)

      await app.db.update(users)
        .set({
          passwordResetTokenHash: tokenHash, // Store HASH, not plaintext
          passwordResetExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      sendEmail(
        app.config.postmark.apiToken,
        app.config.postmark.fromEmail,
        user.email,
        'Reset your Aegis password',
        buildResetPasswordHtml(app.config.baseUrl, resetToken), // Send plaintext token in email only
      ).catch(err => app.log.error({ err }, 'Failed to send reset email'));
    }

    return reply.send({ success: true });
  });

  // Reset password
  app.post('/api/auth/reset-password', async (req, reply) => {
    const body = resetPasswordSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    // Hash the submitted token and compare against stored hash
    const tokenHash = createHash('sha256').update(body.data.token).digest('hex');
    const [user] = await app.db.select()
      .from(users)
      .where(eq(users.passwordResetTokenHash, tokenHash));

    if (!user) {
      return reply.status(400).send({ error: 'Invalid or expired token' });
    }

    if (user.passwordResetExpiresAt && user.passwordResetExpiresAt < new Date()) {
      return reply.status(400).send({ error: 'Token expired' });
    }

    const passwordHash = await hashPassword(body.data.password);

    // Single-use: clear token immediately
    await app.db.update(users)
      .set({
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return reply.send({ success: true });
  });
}
```

- [ ] **Step 4: Update index.ts to wire up DB, auth, and routes**

Replace `server/src/index.ts`:

```typescript
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import { loadConfig, type AppConfig } from './config.js';
import { getDb, type AegisDb } from './db/index.js';
import authPlugin from './auth/plugin.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    db: AegisDb;
    requireAuth: (req: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>;
  }
}

export async function buildApp(overrides: Partial<AppConfig> = {}) {
  const config = loadConfig(overrides);
  const app = Fastify({ logger: !config.testing });

  const db = getDb(config.databaseUrl);

  await app.register(cookie, { secret: config.secretKey });
  await app.register(cors, {
    origin: config.testing ? true : config.baseUrl,
    credentials: true,
  });
  await app.register(formbody);

  app.decorate('config', config);
  app.decorate('db', db);

  await app.register(authPlugin);
  await app.register(healthRoutes);
  await app.register(authRoutes);

  return app;
}

async function start() {
  const app = await buildApp();
  const config = loadConfig();

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`Aegis SaaS server listening on ${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const isMainModule = process.argv[1] && !process.argv[1].includes('vitest');
if (isMainModule) {
  start();
}
```

- [ ] **Step 5: Run tests**

Run: `cd server && npx vitest run`
Expected: All tests PASS (health + auth + auth-routes)

**Note:** Auth route tests require a running Postgres instance (docker compose up). Tests hit real DB — this is intentional (integration tests, not mocked).

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/auth.ts server/src/index.ts server/tests/auth-routes.test.ts
git commit -m "feat: multi-user auth — register, login, verify email, password reset"
```

---

## Task 8: Stripe Billing — Checkout, Webhook, Subscription Lifecycle

**Files:**
- Create: `server/src/services/stripe.ts`
- Create: `server/src/routes/billing.ts`
- Modify: `server/src/index.ts` (register billing routes)
- Test: `server/tests/billing.test.ts`

- [ ] **Step 1: Write billing tests**

Create `server/tests/billing.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/index.js';

describe('Billing routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    // Register + login
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        displayName: 'Billing Test',
        email: 'billing@example.com',
        password: 'testpass12345',
        timezone: 'UTC',
      },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'billing@example.com', password: 'testpass12345' },
    });
    cookies = String(loginRes.headers['set-cookie']);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects checkout without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/checkout',
      payload: { plan: 'relay' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects checkout with invalid plan', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/checkout',
      headers: { cookie: cookies },
      payload: { plan: 'invalid' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns subscription status for user with no subscription', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/billing/subscription',
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.subscription).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/billing.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Stripe service**

Create `server/src/services/stripe.ts`:

```typescript
import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export function getStripe(secretKey: string): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2025-04-30.basil',
    });
  }
  return stripeInstance;
}

export async function createCheckoutSession(
  stripe: Stripe,
  params: {
    customerId?: string;
    customerEmail: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
  },
): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: params.customerId || undefined,
    customer_email: params.customerId ? undefined : params.customerEmail,
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
  });

  return session.url!;
}

export async function createPortalSession(
  stripe: Stripe,
  customerId: string,
  returnUrl: string,
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}
```

- [ ] **Step 4: Implement billing routes**

Create `server/src/routes/billing.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { users, subscriptions, stripeWebhookEvents } from '../db/schema.js';
import { getStripe, createCheckoutSession, createPortalSession } from '../services/stripe.js';
import type Stripe from 'stripe';

const checkoutSchema = z.object({
  plan: z.enum(['relay', 'hosted']),
});

export async function billingRoutes(app: FastifyInstance) {
  // Create checkout session
  app.post('/api/billing/checkout', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const body = checkoutSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid plan. Must be "relay" or "hosted".' });
    }

    const [user] = await app.db.select()
      .from(users)
      .where(eq(users.id, req.userId!));

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Check for existing active subscription
    const [existingSub] = await app.db.select()
      .from(subscriptions)
      .where(and(
        eq(subscriptions.userId, req.userId!),
        eq(subscriptions.status, 'active'),
      ));

    if (existingSub) {
      return reply.status(409).send({ error: 'Active subscription already exists. Use portal to manage.' });
    }

    const stripe = getStripe(app.config.stripe.secretKey);
    const priceId = body.data.plan === 'relay'
      ? app.config.stripe.relayPriceId
      : app.config.stripe.hostedPriceId;

    if (!priceId) {
      return reply.status(500).send({ error: 'Stripe price not configured for this plan' });
    }

    const url = await createCheckoutSession(stripe, {
      customerEmail: user.email,
      priceId,
      successUrl: `${app.config.baseUrl}/billing?success=true`,
      cancelUrl: `${app.config.baseUrl}/billing?cancelled=true`,
      metadata: {
        userId: user.id,
        plan: body.data.plan,
      },
    });

    return reply.send({ url });
  });

  // Customer portal
  app.post('/api/billing/portal', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const [sub] = await app.db.select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, req.userId!));

    if (!sub) {
      return reply.status(404).send({ error: 'No subscription found' });
    }

    const stripe = getStripe(app.config.stripe.secretKey);
    const url = await createPortalSession(
      stripe,
      sub.stripeCustomerId,
      `${app.config.baseUrl}/billing`,
    );

    return reply.send({ url });
  });

  // Get current subscription
  app.get('/api/billing/subscription', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const [sub] = await app.db.select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, req.userId!));

    if (!sub) {
      return reply.send({ subscription: null });
    }

    return reply.send({
      subscription: {
        id: sub.id,
        plan: sub.plan,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
        cancelledAt: sub.cancelledAt?.toISOString() ?? null,
      },
    });
  });

  // Stripe webhook
  app.post('/api/billing/webhook', {
    config: { rawBody: true },
  }, async (req, reply) => {
    const stripe = getStripe(app.config.stripe.secretKey);
    const sig = req.headers['stripe-signature'];

    if (!sig || !app.config.stripe.webhookSecret) {
      return reply.status(400).send({ error: 'Missing signature' });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody as string,
        sig as string,
        app.config.stripe.webhookSecret,
      );
    } catch (err) {
      return reply.status(400).send({ error: 'Invalid signature' });
    }

    // Idempotency check
    const [existing] = await app.db.select()
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.id, event.id));

    if (existing) {
      return reply.send({ received: true });
    }

    await app.db.insert(stripeWebhookEvents).values({
      id: event.id,
      type: event.type,
    });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;

        if (userId && plan && session.subscription && session.customer) {
          await app.db.insert(subscriptions).values({
            userId,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            plan,
            status: 'active',
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await app.db.update(subscriptions)
          .set({
            status: sub.status === 'active' ? 'active'
              : sub.status === 'past_due' ? 'past_due'
              : sub.status === 'canceled' ? 'cancelled'
              : sub.status === 'trialing' ? 'trialing'
              : sub.status === 'paused' ? 'paused'
              : 'active',
            currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.stripeSubscriptionId, sub.id));
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await app.db.update(subscriptions)
          .set({
            status: 'cancelled',
            cancelledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.stripeSubscriptionId, sub.id));
        break;
      }
    }

    return reply.send({ received: true });
  });
}
```

- [ ] **Step 5: Register billing routes in index.ts**

Add to `server/src/index.ts` after `authRoutes` import:

```typescript
import { billingRoutes } from './routes/billing.js';
```

Add after `await app.register(authRoutes);`:

```typescript
await app.register(billingRoutes);
```

Also add raw body support. After `await app.register(formbody);`, add:

```typescript
  app.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
    try {
      const json = JSON.parse(body as string);
      (req as any).rawBody = body;
      done(null, json);
    } catch (err) {
      done(err as Error, undefined);
    }
  });
```

And update the Fastify instance declaration to include rawBody:

```typescript
declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}
```

- [ ] **Step 6: Run tests**

Run: `cd server && npx vitest run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add server/src/services/stripe.ts server/src/routes/billing.ts server/tests/billing.test.ts server/src/index.ts
git commit -m "feat: stripe billing — checkout, portal, webhook, subscription lifecycle"
```

---

## Task 9: Public Pricing API

**Files:**
- Create: `server/src/routes/pricing.ts`
- Modify: `server/src/index.ts` (register route)
- Test: `server/tests/pricing.test.ts`

- [ ] **Step 1: Write pricing tests**

Create `server/tests/pricing.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/index.js';

describe('GET /api/pricing', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns pricing plans without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/pricing' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.plans).toBeDefined();
    expect(body.plans.length).toBe(2);
    expect(body.plans[0].id).toBe('relay');
    expect(body.plans[1].id).toBe('hosted');
    // price may be null if Stripe/env not configured
    expect(body.plans[0].price === null || body.plans[0].price > 0).toBe(true);
    expect(body.plans[0].interval).toBe('month');
    expect(body.plans[0].features).toBeDefined();
    expect(Array.isArray(body.plans[0].features)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/pricing.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement pricing route**

Create `server/src/routes/pricing.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import type { PricingResponse } from '@aegis-site/shared';

// Pricing approach:
// - Alpha: env-configured fallback display prices (AEGIS_RELAY_DISPLAY_PRICE, AEGIS_HOSTED_DISPLAY_PRICE)
// - Post-alpha: read Stripe Price objects via STRIPE_RELAY_PRICE_ID, STRIPE_HOSTED_PRICE_ID
// - If Stripe unavailable: return plan names/features with price: null and pricingUrl link
// - Do not hardcode final prices

export async function pricingRoutes(app: FastifyInstance) {
  app.get('/api/pricing', async (_req, reply) => {
    const relayPrice = process.env.AEGIS_RELAY_DISPLAY_PRICE
      ? parseInt(process.env.AEGIS_RELAY_DISPLAY_PRICE, 10)
      : null;
    const hostedPrice = process.env.AEGIS_HOSTED_DISPLAY_PRICE
      ? parseInt(process.env.AEGIS_HOSTED_DISPLAY_PRICE, 10)
      : null;

    // TODO post-alpha: read from Stripe Price objects if STRIPE_RELAY_PRICE_ID configured

    const response: PricingResponse = {
      plans: [
        {
          id: 'relay',
          name: 'Aegis Relay',
          price: relayPrice,
          currency: 'usd',
          interval: 'month',
          features: [
            'Cloud heartbeat monitoring',
            'Offline host alerts',
            'Reliable notification delivery',
            'Hosted claim portal',
            'Escalation timers',
            'Delivery receipts',
          ],
          pricingUrl: 'https://aegisdms.life/pricing',
        },
        {
          id: 'hosted',
          name: 'Aegis Hosted',
          price: hostedPrice,
          currency: 'usd',
          interval: 'month',
          features: [
            'Everything in Relay',
            'Fully managed dashboard',
            'Managed encrypted storage',
            'No Docker required',
            'No SMTP/Telegram setup',
            'Priority support',
            'Helper Pack (coming soon)',
          ],
          pricingUrl: 'https://aegisdms.life/pricing',
        },
      ],
    };

    return reply.send(response);
  });
}
```

- [ ] **Step 4: Register pricing route in index.ts**

Add import and registration in `server/src/index.ts`:

```typescript
import { pricingRoutes } from './routes/pricing.js';
// ... after billingRoutes registration:
await app.register(pricingRoutes);
```

- [ ] **Step 5: Run tests**

Run: `cd server && npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/pricing.ts server/tests/pricing.test.ts server/src/index.ts
git commit -m "feat: public pricing API endpoint consumed by OSS app"
```

---

## Task 10: React + Vite Frontend Scaffold

**Files:**
- Create: `web/vite.config.ts`
- Create: `web/tailwind.config.ts`
- Create: `web/postcss.config.js`
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx`
- Create: `web/src/index.css`
- Create: `web/src/lib/api.ts`

- [ ] **Step 1: Create Vite config**

Create `web/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/api': 'http://localhost:8001',
      '/health': 'http://localhost:8001',
    },
  },
  build: {
    outDir: '../server/static',
    emptyOutDir: true,
  },
});
```

- [ ] **Step 2: Create Tailwind config**

Create `web/tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        hand: ['Caveat', 'cursive'],
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          bg: '#DDE8F4',
          ink: '#0B1C2C',
          accent: '#1A6B9A',
          muted: '#4A6B8A',
          surface: '#C8D9ED',
          border: '#8AAAC8',
          danger: '#C0392B',
          success: '#27AE60',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 3: Create PostCSS config**

Create `web/postcss.config.js`:

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: Create index.html**

Create `web/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aegis DMS — Digital Legacy System</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
</head>
<body class="bg-brand-bg text-brand-ink">
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 5: Create CSS + main entry + API client**

Create `web/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { height: 100%; }
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #8AAAC8; border-radius: 99px; }
```

Create `web/src/lib/api.ts`:

```typescript
const BASE = '';

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const put = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export const del = <T>(path: string) =>
  api<T>(path, { method: 'DELETE' });
```

Create `web/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

- [ ] **Step 6: Commit**

```bash
git add web/vite.config.ts web/tailwind.config.ts web/postcss.config.js web/index.html web/src/index.css web/src/lib/api.ts web/src/main.tsx
git commit -m "feat: react + vite + tailwind frontend scaffold"
```

---

## Task 11: Auth Pages — Register, Login, Reset Password

**Files:**
- Create: `web/src/App.tsx`
- Create: `web/src/pages/auth/Register.tsx`
- Create: `web/src/pages/auth/Login.tsx`
- Create: `web/src/pages/auth/ResetPassword.tsx`
- Create: `web/src/pages/auth/RequestReset.tsx`

- [ ] **Step 1: Create App.tsx with routing**

Create `web/src/App.tsx`:

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import { get } from './lib/api';
import Register from './pages/auth/Register';
import Login from './pages/auth/Login';
import RequestReset from './pages/auth/RequestReset';
import ResetPassword from './pages/auth/ResetPassword';

interface AuthUser {
  id: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  timezone: string;
}

interface AuthContextType {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, setUser: () => {} });
export const useAuth = () => useContext(AuthContext);

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<AuthUser>('/api/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-hand text-3xl text-brand-muted">
        Loading...
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <Routes>
        <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/forgot-password" element={<RequestReset />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={
          user ? (
            <div className="min-h-screen p-8">
              <h1 className="font-hand text-4xl font-bold mb-4">Dashboard</h1>
              <p className="font-sans text-brand-muted">Welcome, {user.displayName}. Dashboard coming soon.</p>
            </div>
          ) : <Navigate to="/login" />
        } />
        <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} />} />
      </Routes>
    </AuthContext.Provider>
  );
}

export default App;
```

- [ ] **Step 2: Create Register page**

Create `web/src/pages/auth/Register.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { post } from '../../lib/api';
import { useAuth } from '../../App';

export default function Register() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await post<{ user: any }>('/api/auth/register', {
        displayName,
        email,
        password,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setUser(res.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-brand-bg">
      <form onSubmit={handleSubmit} className="w-full max-w-md p-8 bg-brand-surface border-2 border-brand-border rounded-lg">
        <h1 className="font-hand text-4xl font-bold mb-2 text-brand-ink">Create Account</h1>
        <p className="font-sans text-sm text-brand-muted mb-6">Protect your legacy with Aegis DMS.</p>

        <input type="text" placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} required
          className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent" />
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
          className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent" />
        <input type="password" placeholder="Passphrase (8+ characters)" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
          className="w-full font-sans text-sm p-3 mb-4 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent" />

        {error && <div className="font-sans text-sm mb-3 text-brand-danger">{error}</div>}

        <button type="submit" disabled={loading}
          className="w-full font-sans font-semibold text-sm p-3 cursor-pointer bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors disabled:opacity-50">
          {loading ? 'Creating...' : 'Create Account'}
        </button>

        <p className="font-sans text-sm text-brand-muted mt-4 text-center">
          Already have an account? <Link to="/login" className="text-brand-accent hover:underline">Log in</Link>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create Login page**

Create `web/src/pages/auth/Login.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { post } from '../../lib/api';
import { useAuth } from '../../App';

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await post<{ user: any }>('/api/auth/login', { email, password });
      setUser(res.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-brand-bg">
      <form onSubmit={handleSubmit} className="w-full max-w-md p-8 bg-brand-surface border-2 border-brand-border rounded-lg">
        <h1 className="font-hand text-4xl font-bold mb-2 text-brand-ink">Welcome Back</h1>
        <p className="font-sans text-sm text-brand-muted mb-6">Log in to your Aegis account.</p>

        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
          className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent" />
        <input type="password" placeholder="Passphrase" value={password} onChange={e => setPassword(e.target.value)} required
          className="w-full font-sans text-sm p-3 mb-4 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent" />

        {error && <div className="font-sans text-sm mb-3 text-brand-danger">{error}</div>}

        <button type="submit" disabled={loading}
          className="w-full font-sans font-semibold text-sm p-3 cursor-pointer bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors disabled:opacity-50">
          {loading ? 'Logging in...' : 'Log In'}
        </button>

        <div className="flex justify-between font-sans text-sm text-brand-muted mt-4">
          <Link to="/register" className="text-brand-accent hover:underline">Create account</Link>
          <Link to="/forgot-password" className="text-brand-accent hover:underline">Forgot password?</Link>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Create RequestReset page**

Create `web/src/pages/auth/RequestReset.tsx`:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { post } from '../../lib/api';

export default function RequestReset() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await post('/api/auth/request-reset', { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-brand-bg">
        <div className="w-full max-w-md p-8 bg-brand-surface border-2 border-brand-border rounded-lg text-center">
          <h1 className="font-hand text-4xl font-bold mb-4 text-brand-ink">Check Your Email</h1>
          <p className="font-sans text-sm text-brand-muted mb-4">
            If an account exists with that email, we sent a password reset link.
          </p>
          <Link to="/login" className="font-sans text-sm text-brand-accent hover:underline">Back to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-brand-bg">
      <form onSubmit={handleSubmit} className="w-full max-w-md p-8 bg-brand-surface border-2 border-brand-border rounded-lg">
        <h1 className="font-hand text-4xl font-bold mb-2 text-brand-ink">Reset Password</h1>
        <p className="font-sans text-sm text-brand-muted mb-6">Enter your email to receive a reset link.</p>

        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
          className="w-full font-sans text-sm p-3 mb-4 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent" />

        {error && <div className="font-sans text-sm mb-3 text-brand-danger">{error}</div>}

        <button type="submit" disabled={loading}
          className="w-full font-sans font-semibold text-sm p-3 cursor-pointer bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors disabled:opacity-50">
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>

        <p className="font-sans text-sm text-brand-muted mt-4 text-center">
          <Link to="/login" className="text-brand-accent hover:underline">Back to login</Link>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Create ResetPassword page**

Create `web/src/pages/auth/ResetPassword.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { post } from '../../lib/api';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await post('/api/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-brand-bg">
        <div className="w-full max-w-md p-8 bg-brand-surface border-2 border-brand-border rounded-lg text-center">
          <h1 className="font-hand text-4xl font-bold mb-4 text-brand-danger">Invalid Link</h1>
          <p className="font-sans text-sm text-brand-muted mb-4">This reset link is invalid or expired.</p>
          <Link to="/forgot-password" className="font-sans text-sm text-brand-accent hover:underline">Request a new one</Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-brand-bg">
        <div className="w-full max-w-md p-8 bg-brand-surface border-2 border-brand-border rounded-lg text-center">
          <h1 className="font-hand text-4xl font-bold mb-4 text-brand-success">Password Reset</h1>
          <p className="font-sans text-sm text-brand-muted">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-brand-bg">
      <form onSubmit={handleSubmit} className="w-full max-w-md p-8 bg-brand-surface border-2 border-brand-border rounded-lg">
        <h1 className="font-hand text-4xl font-bold mb-2 text-brand-ink">New Password</h1>
        <p className="font-sans text-sm text-brand-muted mb-6">Enter your new passphrase.</p>

        <input type="password" placeholder="New passphrase (8+ characters)" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
          className="w-full font-sans text-sm p-3 mb-4 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent" />

        {error && <div className="font-sans text-sm mb-3 text-brand-danger">{error}</div>}

        <button type="submit" disabled={loading}
          className="w-full font-sans font-semibold text-sm p-3 cursor-pointer bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors disabled:opacity-50">
          {loading ? 'Resetting...' : 'Set New Password'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Verify frontend builds**

Run: `cd web && npm run build`
Expected: Build output in `server/static/`

- [ ] **Step 7: Commit**

```bash
git add web/src/
git commit -m "feat: auth pages — register, login, request reset, reset password"
```

---

## Task 12: CSRF Protection

**Goal:** Implement CSRF protection for all state-mutating API endpoints. The server issues a signed CSRF token tied to the session, and the frontend includes it on all POST, PUT, PATCH, and DELETE requests.

**Files:**
- Create: `server/src/auth/csrf.ts`
- Modify: `server/src/index.ts` (register CSRF preHandler hook)
- Create: `server/src/routes/csrf.ts`
- Modify: `web/src/lib/api.ts` (fetch and include CSRF token)
- Create: `server/tests/csrf.test.ts`

- [ ] **Step 1: Write CSRF tests**

Create `server/tests/csrf.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/index.js';

describe('CSRF protection', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    // Register a test user and login to get session
    await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { email: 'csrf@test.com', displayName: 'CSRF Test', password: 'testpass123' },
    });
    const loginRes = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'csrf@test.com', password: 'testpass123' },
    });
    cookies = String(loginRes.headers['set-cookie']);
  });

  afterAll(async () => { await app.close(); });

  it('GET /api/csrf returns a CSRF token', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/csrf',
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.csrfToken).toBeDefined();
    expect(typeof body.csrfToken).toBe('string');
  });

  it('rejects POST without CSRF token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/estate-items',
      headers: { cookie: cookies },
      payload: { category: 'Financial', title: 'Test Item' },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('CSRF');
  });

  it('rejects POST with invalid CSRF token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/estate-items',
      headers: { cookie: cookies, 'x-csrf-token': 'invalid-token' },
      payload: { category: 'Financial', title: 'Test Item' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('accepts POST with valid CSRF token', async () => {
    const csrfRes = await app.inject({
      method: 'GET', url: '/api/csrf',
      headers: { cookie: cookies },
    });
    const { csrfToken } = JSON.parse(csrfRes.payload);

    const res = await app.inject({
      method: 'POST', url: '/api/estate-items',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: { category: 'Financial', title: 'Test Item' },
    });
    expect([200, 201]).toContain(res.statusCode);
  });

  it('rejects CSRF token from another session', async () => {
    const csrfRes = await app.inject({
      method: 'GET', url: '/api/csrf',
      headers: { cookie: cookies },
    });
    const { csrfToken } = JSON.parse(csrfRes.payload);

    // Register and login as different user
    await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { email: 'other@test.com', displayName: 'Other', password: 'testpass123' },
    });
    const otherLogin = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'other@test.com', password: 'testpass123' },
    });
    const otherCookies = String(otherLogin.headers['set-cookie']);

    // Use first user's CSRF token with second user's session
    const res = await app.inject({
      method: 'POST', url: '/api/estate-items',
      headers: { cookie: otherCookies, 'x-csrf-token': csrfToken },
      payload: { category: 'Financial', title: 'Test Item' },
    });
    expect(res.statusCode).toBe(403);
  });
});
```

- [ ] **Step 2: Implement CSRF module**

Create `server/src/auth/csrf.ts`:

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

const CSRF_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export function generateCsrfToken(sessionId: string, secretKey: string): string {
  const timestamp = Date.now().toString(36);
  const payload = `${sessionId}:${timestamp}`;
  const signature = createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');
  return `${payload}:${signature}`;
}

export function validateCsrfToken(
  token: string,
  sessionId: string,
  secretKey: string,
): boolean {
  const parts = token.split(':');
  if (parts.length !== 3) return false;

  const [tokenSessionId, timestamp, providedSignature] = parts;

  if (tokenSessionId !== sessionId) return false;

  const created = parseInt(timestamp, 36);
  if (isNaN(created) || Date.now() - created > CSRF_TTL_MS) return false;

  const payload = `${tokenSessionId}:${timestamp}`;
  const expectedSignature = createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');

  try {
    return timingSafeEqual(
      Buffer.from(providedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: Create CSRF route**

Create `server/src/routes/csrf.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import { generateCsrfToken } from '../auth/csrf.js';

export async function csrfRoutes(app: FastifyInstance) {
  app.get('/api/csrf', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const sessionId = req.cookies?.aegis_session;
    if (!sessionId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }
    const csrfToken = generateCsrfToken(sessionId, app.config.secretKey);
    return reply.send({ csrfToken });
  });
}
```

- [ ] **Step 4: Register CSRF preHandler hook in index.ts**

Add a Fastify `onRequest` hook that validates CSRF tokens on all POST, PUT, PATCH, and DELETE requests to `/api/*`. Exempt paths that operate before a session exists:

```typescript
import { validateCsrfToken } from './auth/csrf.js';
import { csrfRoutes } from './routes/csrf.js';

// Register csrf routes
await app.register(csrfRoutes);

// CSRF validation hook
app.addHook('onRequest', async (req, reply) => {
  const method = req.method;
  const url = req.url;

  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;
  if (!url.startsWith('/api/')) return;

  // Exempt auth routes that operate before session exists, and Stripe webhook
  const exemptPaths = ['/api/auth/register', '/api/auth/login', '/api/auth/logout',
    '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/verify-email',
    '/api/billing/webhook'];
  if (exemptPaths.some(p => url.startsWith(p))) return;

  const sessionId = req.cookies?.aegis_session;
  if (!sessionId) return; // Auth handler will reject

  const csrfToken = req.headers['x-csrf-token'] as string | undefined;
  if (!csrfToken || !validateCsrfToken(csrfToken, sessionId, app.config.secretKey)) {
    return reply.status(403).send({ error: 'CSRF token missing or invalid' });
  }
});
```

- [ ] **Step 5: Update frontend API client**

Update `web/src/lib/api.ts` to fetch and include CSRF tokens on state-mutating requests. See OSS Phase 1 Task 13 Step 5 for reference pattern. Key requirements:
- Store CSRF token in memory (not localStorage)
- Fetch from `GET /api/csrf` on first state-mutating request
- Include `X-CSRF-Token` header on POST/PUT/PATCH/DELETE
- `clearCsrfToken()` export for use on logout

- [ ] **Step 6: Run tests**

Run: `cd server && npx vitest run`
Expected: All tests PASS including CSRF tests

- [ ] **Step 7: Commit**

```bash
git add server/src/auth/csrf.ts server/src/routes/csrf.ts server/tests/csrf.test.ts server/src/index.ts web/src/lib/api.ts
git commit -m "feat: CSRF protection with signed session-bound tokens"
```

---

## Phase 1 Complete Checklist

After completing all tasks:

- [ ] `docker compose up -d` starts Postgres
- [ ] `npm install` succeeds
- [ ] `npm run db:migrate` applies migrations
- [ ] `npm test` passes all tests (health, auth, auth-routes, billing, pricing, email, csrf)
- [ ] `cd web && npm run build` builds frontend
- [ ] Server starts: `cd server && npx tsx src/index.ts`
- [ ] `GET /health` returns `200 ok`
- [ ] `GET /api/pricing` returns plans (no auth required)
- [ ] Registration flow works (creates user + session)
- [ ] Login/logout works
- [ ] Email verification flow works (with Postmark configured)
- [ ] Password reset flow works
- [ ] `POST /api/billing/checkout` creates Stripe checkout (with Stripe keys configured)
- [ ] `GET /api/billing/subscription` returns null for new users
- [ ] Stripe webhook handles checkout.session.completed, subscription updates, and deletions
- [ ] CSRF: `GET /api/csrf` returns token, POST without token rejected, POST with valid token accepted

---

## Next Phase

Phase 2 plan covers:
- Relay API: accept heartbeats, store connection state
- Relay Monitoring: detect offline instances, send alerts (local host may still be needed for release)
- Relay Escrow: explicit trusted mode where SaaS holds release material and can execute release
- Authorization-code relay linking flow (no API keys in URLs)
- Hosted estate/contacts/switches CRUD (user-scoped)
- Marketing landing page
- Pricing page with live Stripe prices
- Billing management (Stripe customer portal)
- App dashboard for hosted users


---

## Patch Notes (from product architecture directive)

### Relay Monitoring vs Relay Escrow

The SaaS must distinguish two relay sub-modes:

- **Relay Monitoring:** Receives heartbeats, detects offline, sends alerts. Local host may still be needed for final release. Does not claim guaranteed release if local host is permanently offline.
- **Relay Escrow:** Explicitly opted into. SaaS holds release material under configured policy. Can execute release if local host is offline. Requires user acknowledgement of trust model.

### Contracts Compatibility

The SaaS repo must maintain compatible `packages/contracts/` schemas with the OSS repo. Contract shapes must not drift silently. Use versioned zod schemas matching OSS `@aegis/contracts` for: packet envelope, release run, heartbeat, claim event, webhook event, storage provider, notification provider.

### CSRF Implementation (Phase 1)

- `GET /api/csrf` returns signed token tied to session
- All POST/PUT/PATCH/DELETE to `/api/*` require X-CSRF-Token header
- Server rejects missing or invalid tokens
- Frontend API client fetches and includes CSRF token
- Tests cover missing, invalid, expired, and valid tokens
- Cookie settings: HttpOnly, Secure in production, SameSite=Lax

### Relay Linking Flow

Use authorization-code exchange, not direct API key passing:
1. OSS generates state + nonce, opens SaaS connect URL
2. User authenticates on SaaS
3. SaaS generates short-lived single-use link code (5-10 min expiry)
4. Redirect back to OSS with code + state only (no API key in URL)
5. OSS exchanges code server-to-server for API key
6. SaaS stores only API key hash
7. OSS stores API key encrypted locally
8. Audit events written on both sides
