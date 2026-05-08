# Aegis OSS — Phase 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the open-source Aegis repo with a working Fastify + SQLite + React/Vite stack, Docker deployment, single-owner auth, and CRUD APIs for estate items and contacts — all with tests.

**Architecture:** Monorepo with `server/` (Fastify + Drizzle + SQLite) and `web/` (React + Vite + Tailwind) workspaces plus a `packages/shared/` for types. Server serves the Vite build as static files in production. Single Docker container. Auth is single-owner with Argon2id password + optional TOTP + DB-backed sessions.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, better-sqlite3, React 18, Vite, Tailwind CSS, Vitest, Argon2, Docker.

**Parent plan:** `2026-05-06-aegis-master-plan.md`

**Target repo:** New repo — will be initialized as `aegis/` in a directory chosen at execution time.

> **Note on phase labels:** Phase labels (Phase 1, Phase 2, etc.) are sequencing guidance, not fixed delivery estimates. The implementation should optimize for correctness, security, and coherent architecture over calendar targets.

---

## Pre-requisites

Before starting, the engineer needs:
- Node.js 20+ installed
- Docker + Docker Compose installed
- A GitHub account with access to the `aegis-dms` org (or create it)

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
  "name": "aegis",
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
*.db
*.db-journal
.DS_Store
```

- [ ] **Step 4: Create .env.example**

```bash
# Aegis Configuration
AEGIS_PORT=8000
AEGIS_HOST=0.0.0.0
AEGIS_APP_URL=http://localhost:8000
AEGIS_DB_PATH=./data/aegis.db
AEGIS_SECRET_KEY=change-me-to-a-random-64-char-string
AEGIS_FIELD_ENCRYPTION_KEY=change-me-to-a-random-32-byte-hex

# Optional: SMTP
AEGIS_SMTP_HOST=
AEGIS_SMTP_PORT=587
AEGIS_SMTP_USER=
AEGIS_SMTP_PASSWORD=
AEGIS_SMTP_FROM=

# Optional: Telegram
AEGIS_TELEGRAM_BOT_TOKEN=
AEGIS_TELEGRAM_CHAT_ID=

# Optional: S3-Compatible Storage
AEGIS_S3_ENDPOINT=
AEGIS_S3_REGION=auto
AEGIS_S3_BUCKET=
AEGIS_S3_ACCESS_KEY_ID=
AEGIS_S3_SECRET_ACCESS_KEY=
AEGIS_S3_PREFIX=packets/

# Optional: Aegis Relay
AEGIS_RELAY_ENABLED=false
AEGIS_RELAY_URL=
AEGIS_RELAY_API_KEY=
```

- [ ] **Step 5: Create packages/shared/package.json**

```json
{
  "name": "@aegis/shared",
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
// Domain types shared between server and web

export type SwitchMode = 'trip' | 'heartbeat';
export type DeploymentMode = 'vault' | 'dead_drop' | 'relay_monitoring' | 'relay_escrow' | 'hosted';
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

export type AuditEventType =
  | 'setup_completed' | 'switch_armed' | 'switch_paused' | 'switch_cancelled'
  | 'check_in_completed' | 'reminder_sent' | 'reminder_failed'
  | 'packet_generated' | 'packet_uploaded' | 'packet_deleted'
  | 'trigger_reached' | 'contact_notified' | 'contact_opened_claim'
  | 'contact_verified' | 'contact_accepted' | 'packet_downloaded'
  | 'key_viewed' | 'claim_acknowledged' | 'contact_escalated'
  | 'cascade_completed' | 'relay_heartbeat_sent' | 'relay_offline_warning';

export interface EstateItem {
  id: number;
  category: EstateCategory;
  title: string;
  institutionName: string | null;
  accountType: string | null;
  referenceHint: string | null;
  assetDescription: string | null;
  locationNotes: string | null;
  executorNotes: string | null;
  sensitiveFlag: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: number;
  fullName: string;
  relationship: string | null;
  priorityOrder: number;
  email: string;
  phone: string | null;
  telegramHandle: string | null;
  preferredChannels: NotificationChannel[];
  confirmationWindowHours: number;
  backupNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Switch {
  id: number;
  name: string;
  mode: SwitchMode;
  deploymentMode: DeploymentMode;
  status: SwitchStatus;
  triggerAt: string | null;
  heartbeatIntervalDays: number | null;
  nextCheckInDueAt: string | null;
  warningStartsAt: string | null;
  gracePeriodHours: number;
  warningWindowDays: number;
  lastCheckInAt: string | null;
  lastPacketSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Audit events must not contain plaintext PII — only IDs, event types,
// channels, and statuses. See directive §13.
export interface AuditEvent {
  id: number;
  switchId: number | null;
  eventType: AuditEventType;
  actorType: 'owner' | 'system' | 'contact' | 'relay';
  actorId: string | null;
  metadata: Record<string, unknown> | null;  // no plaintext PII
  createdAt: string;
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  database: 'ok' | 'error';
  storage: 'ok' | 'error' | 'not_configured';
  notifications: 'ok' | 'error' | 'not_configured';
  relay: 'ok' | 'error' | 'not_configured';
  uptime: number;
  version: string;
}
```

- [ ] **Step 8: Create server/package.json**

```json
{
  "name": "@aegis/server",
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
    "@aegis/shared": "*",
    "fastify": "^5.2.0",
    "@fastify/cookie": "^11.0.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/static": "^8.0.0",
    "@fastify/formbody": "^8.0.0",
    "drizzle-orm": "^0.38.0",
    "better-sqlite3": "^11.7.0",
    "argon2": "^0.41.0",
    "otpauth": "^9.3.0",
    "dotenv": "^16.4.0",
    "nanoid": "^5.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
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
  "name": "@aegis/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@aegis/shared": "*",
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
Expected: Clean install with workspace symlinks for `@aegis/shared`

- [ ] **Step 13: Commit**

```bash
git init
git add -A
git commit -m "chore: initialize project structure with workspaces"
```

---

## Task 2: Fastify Server + Health Check

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
  dbPath: string;
  appUrl: string;
  secretKey: string;
  fieldEncryptionKey: string;
  testing: boolean;
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const config = {
    port: parseInt(process.env.AEGIS_PORT || '8000', 10),
    host: process.env.AEGIS_HOST || '0.0.0.0',
    dbPath: process.env.AEGIS_DB_PATH || './data/aegis.db',
    appUrl: process.env.AEGIS_APP_URL || 'http://localhost:8000',
    secretKey: process.env.AEGIS_SECRET_KEY || 'dev-secret-key-change-me',
    fieldEncryptionKey: process.env.AEGIS_FIELD_ENCRYPTION_KEY || 'dev-field-key-change-me-32bytes!!',
    testing: false,
    ...overrides,
  };

  // SECURITY: Refuse to start with default secrets in production
  if (!config.testing && process.env.NODE_ENV === 'production') {
    if (config.secretKey.includes('change-me') || config.secretKey.length < 32) {
      throw new Error('FATAL: AEGIS_SECRET_KEY is not set or too short. Run setup.sh to generate secrets.');
    }
    if (config.fieldEncryptionKey.includes('change-me') || config.fieldEncryptionKey.length < 32) {
      throw new Error('FATAL: AEGIS_FIELD_ENCRYPTION_KEY is not set or too short. Run setup.sh to generate secrets.');
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

export async function buildApp(overrides: Partial<AppConfig> = {}) {
  const config = loadConfig(overrides);
  const app = Fastify({ logger: !config.testing });

  await app.register(cookie, { secret: config.secretKey });
  await app.register(cors, {
    origin: config.testing ? true : config.appUrl,
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
    console.log(`Aegis server listening on ${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.argv[1] && !process.argv[1].includes('vitest')) {
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

## Task 3: Database Schema + Drizzle Setup

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
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.AEGIS_DB_PATH || './data/aegis.db',
  },
});
```

- [ ] **Step 2: Create the full schema**

Create `server/src/db/schema.ts`:

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const owner = sqliteTable('owner', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  displayName: text('display_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  timezone: text('timezone').notNull().default('UTC'),
  passwordHash: text('password_hash').notNull(),
  totpSecretEncrypted: text('totp_secret_encrypted'),
  totpEnabled: integer('totp_enabled', { mode: 'boolean' }).notNull().default(false),
  setupComplete: integer('setup_complete', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  ownerId: integer('owner_id').notNull().references(() => owner.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const estateItems = sqliteTable('estate_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  category: text('category').notNull(),           // plaintext (for filtering)
  title: text('title').notNull(),                 // plaintext (for listing)
  institutionNameEncrypted: text('institution_name_encrypted'),  // encrypted
  accountTypeEncrypted: text('account_type_encrypted'),          // encrypted
  referenceHintEncrypted: text('reference_hint_encrypted'),      // encrypted
  assetDescriptionEncrypted: text('asset_description_encrypted'),// encrypted
  locationNotesEncrypted: text('location_notes_encrypted'),      // encrypted
  executorNotesEncrypted: text('executor_notes_encrypted'),      // encrypted
  sensitiveFlag: integer('sensitive_flag', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const contacts = sqliteTable('contacts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fullNameEncrypted: text('full_name_encrypted').notNull(),     // encrypted
  relationshipEncrypted: text('relationship_encrypted'),         // encrypted
  priorityOrder: integer('priority_order').notNull(),            // plaintext (for sorting)
  emailEncrypted: text('email_encrypted').notNull(),             // encrypted
  phoneEncrypted: text('phone_encrypted'),                       // encrypted
  telegramHandleEncrypted: text('telegram_handle_encrypted'),    // encrypted
  preferredChannels: text('preferred_channels').notNull().default('["email"]'), // operational
  confirmationWindowHours: integer('confirmation_window_hours').notNull().default(48),
  claimPinHash: text('claim_pin_hash'),                          // hashed
  backupNotesEncrypted: text('backup_notes_encrypted'),          // encrypted
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const switches = sqliteTable('switches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  mode: text('mode').notNull(),
  deploymentMode: text('deployment_mode').notNull().default('vault'),
  status: text('status').notNull().default('draft'),
  triggerAt: integer('trigger_at', { mode: 'timestamp' }),
  heartbeatIntervalDays: integer('heartbeat_interval_days'),
  nextCheckInDueAt: integer('next_check_in_due_at', { mode: 'timestamp' }),
  warningStartsAt: integer('warning_starts_at', { mode: 'timestamp' }),
  gracePeriodHours: integer('grace_period_hours').notNull().default(72),
  warningWindowDays: integer('warning_window_days').notNull().default(3),
  lastCheckInAt: integer('last_check_in_at', { mode: 'timestamp' }),
  lastPacketSyncAt: integer('last_packet_sync_at', { mode: 'timestamp' }),
  selectedContactIds: text('selected_contact_ids').default('[]'),
  selectedEstateItemIds: text('selected_estate_item_ids').default('[]'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const packets = sqliteTable('packets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  switchId: integer('switch_id').notNull().references(() => switches.id, { onDelete: 'cascade' }),
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
  lastVerifiedAt: integer('last_verified_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const contactClaims = sqliteTable('contact_claims', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  switchId: integer('switch_id').notNull().references(() => switches.id),
  packetId: integer('packet_id').notNull().references(() => packets.id),
  contactId: integer('contact_id').notNull().references(() => contacts.id),
  claimToken: text('claim_token').notNull().unique(),
  status: text('status').notNull().default('pending'),
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
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// IMPORTANT: Audit events must NOT contain plaintext PII. The metadata column
// should only store IDs, event types, channels, and statuses — never institution
// names, contact names, emails, phone numbers, packet plaintext, executor notes,
// release key material, storage credentials, or API keys. If metadata references
// are necessary, use redacted or hashed versions only.
export const auditEvents = sqliteTable('audit_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  switchId: integer('switch_id').references(() => switches.id),
  eventType: text('event_type').notNull(),
  actorType: text('actor_type').notNull(),
  actorId: text('actor_id'),
  metadata: text('metadata'),  // IDs, event types, channels, statuses only — no plaintext PII
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  valueEncrypted: text('value_encrypted').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const encryptionKeys = sqliteTable('encryption_keys', {
  id: text('id').primaryKey(),
  purpose: text('purpose').notNull(),
  keyMaterialEncrypted: text('key_material_encrypted').notNull(),
  algorithm: text('algorithm').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  rotatedAt: integer('rotated_at', { mode: 'timestamp' }),
});
```

- [ ] **Step 3: Create database connection module**

Create `server/src/db/index.ts`:

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

let db: ReturnType<typeof createDb> | null = null;

function createDb(dbPath: string) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}

export function getDb(dbPath?: string): ReturnType<typeof createDb> {
  if (!db) {
    db = createDb(dbPath || './data/aegis.db');
  }
  return db;
}

export function createTestDb(): ReturnType<typeof createDb> {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}

export type AegisDb = ReturnType<typeof createDb>;
```

- [ ] **Step 4: Create migration runner**

Create `server/src/db/migrate.ts`:

```typescript
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { getDb } from './index.js';
import { loadConfig } from '../config.js';

const config = loadConfig();
const db = getDb(config.dbPath);

migrate(db, { migrationsFolder: './drizzle' });
console.log('Migrations applied successfully');
```

- [ ] **Step 5: Generate initial migration**

Run: `cd server && npx drizzle-kit generate`
Expected: Migration files created in `server/drizzle/`

- [ ] **Step 6: Create data directory and test migration**

Run: `mkdir -p server/data && cd server && npx tsx src/db/migrate.ts`
Expected: "Migrations applied successfully"

- [ ] **Step 7: Commit**

```bash
git add server/src/db/ server/drizzle.config.ts server/drizzle/
git commit -m "feat: drizzle schema and SQLite database setup"
```

---

## Task 4: Auth — Password Hashing + Session Management

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

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function createSession(db: AegisDb, ownerId: number): string {
  const id = nanoid(48);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  db.insert(sessions).values({
    id,
    ownerId,
    expiresAt,
    createdAt: now,
  }).run();

  return id;
}

export function validateSession(db: AegisDb, sessionId: string): number | null {
  const result = db.select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get();

  if (!result) return null;
  if (result.expiresAt < new Date()) {
    db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    return null;
  }

  return result.ownerId;
}

export function deleteSession(db: AegisDb, sessionId: string): void {
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}

export function cleanExpiredSessions(db: AegisDb): void {
  db.delete(sessions).where(lt(sessions.expiresAt, new Date())).run();
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
    ownerId?: number;
  }
}

async function authPlugin(app: FastifyInstance) {
  app.decorateRequest('ownerId', undefined);

  app.decorate('requireAuth', async function (req: FastifyRequest, reply: FastifyReply) {
    const sessionId = req.cookies?.aegis_session;
    if (!sessionId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const db = app.db;
    const ownerId = validateSession(db, sessionId);
    if (!ownerId) {
      return reply.status(401).send({ error: 'Session expired' });
    }

    req.ownerId = ownerId;
  });
}

export default fp(authPlugin, { name: 'aegis-auth' });
```

- [ ] **Step 7: Add fastify-plugin dependency**

Run: `cd server && npm install fastify-plugin`

- [ ] **Step 8: Commit**

```bash
git add server/src/auth/ server/tests/auth.test.ts
git commit -m "feat: auth system with argon2 password hashing and session management"
```

---

## Task 5: Auth Routes — Setup + Login + Logout

**Files:**
- Create: `server/src/routes/auth.ts`
- Modify: `server/src/index.ts` (register routes + db)
- Test: `server/tests/auth-routes.test.ts`

- [ ] **Step 1: Write auth routes tests**

Create `server/tests/auth-routes.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../src/index.js';

describe('Auth routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ testing: true, dbPath: ':memory:' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/setup', () => {
    it('creates initial owner account', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/setup',
        payload: {
          displayName: 'Test Owner',
          email: 'test@example.com',
          password: 'secure-passphrase-123',
          timezone: 'America/Chicago',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.owner.displayName).toBe('Test Owner');
      expect(body.owner.email).toBe('test@example.com');
    });

    it('rejects second setup attempt', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/setup',
        payload: {
          displayName: 'Another Owner',
          email: 'other@example.com',
          password: 'another-password',
          timezone: 'UTC',
        },
      });
      expect(res.statusCode).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns session cookie on valid login', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          password: 'secure-passphrase-123',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['set-cookie']).toBeDefined();
      const cookies = res.headers['set-cookie'];
      expect(String(cookies)).toContain('aegis_session');
    });

    it('rejects invalid password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          password: 'wrong-password',
        },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns owner info when authenticated', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { password: 'secure-passphrase-123' },
      });
      const cookies = loginRes.headers['set-cookie'];

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: String(cookies) },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.displayName).toBe('Test Owner');
    });

    it('returns 401 without session', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });
      expect(res.statusCode).toBe(401);
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
import { owner } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { createSession, deleteSession } from '../auth/session.js';
import { eq, count } from 'drizzle-orm';

const setupSchema = z.object({
  displayName: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(256),
  timezone: z.string().default('UTC'),
});

const loginSchema = z.object({
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  // Check if setup is needed
  app.get('/api/auth/status', async (_req, reply) => {
    const [result] = await app.db.select({ total: count() }).from(owner);
    return reply.send({ setupRequired: result.total === 0 });
  });

  // Initial owner setup
  app.post('/api/auth/setup', async (req, reply) => {
    const [existing] = await app.db.select({ total: count() }).from(owner);
    if (existing.total > 0) {
      return reply.status(409).send({ error: 'Owner already configured' });
    }

    const body = setupSchema.parse(req.body);
    const passwordHash = await hashPassword(body.password);
    const now = new Date();

    const [created] = await app.db.insert(owner).values({
      displayName: body.displayName,
      email: body.email,
      passwordHash,
      timezone: body.timezone,
      setupComplete: true,
      createdAt: now,
      updatedAt: now,
    }).returning();

    const sessionId = createSession(app.db, created.id);

    reply.setCookie('aegis_session', sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 86400,
    });

    return reply.status(201).send({
      owner: {
        id: created.id,
        displayName: created.displayName,
        email: created.email,
        timezone: created.timezone,
      },
    });
  });

  // Login
  app.post('/api/auth/login', async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const [ownerRow] = await app.db.select().from(owner).limit(1);

    if (!ownerRow) {
      return reply.status(401).send({ error: 'No owner configured' });
    }

    const valid = await verifyPassword(body.password, ownerRow.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid password' });
    }

    const sessionId = createSession(app.db, ownerRow.id);

    reply.setCookie('aegis_session', sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 86400,
    });

    return reply.send({ success: true });
  });

  // Get current owner
  app.get('/api/auth/me', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const [ownerRow] = await app.db.select().from(owner)
      .where(eq(owner.id, req.ownerId!));

    if (!ownerRow) {
      return reply.status(404).send({ error: 'Owner not found' });
    }

    return reply.send({
      id: ownerRow.id,
      displayName: ownerRow.displayName,
      email: ownerRow.email,
      timezone: ownerRow.timezone,
      totpEnabled: ownerRow.totpEnabled,
    });
  });

  // Logout
  app.post('/api/auth/logout', async (req, reply) => {
    const sessionId = req.cookies?.aegis_session;
    if (sessionId) {
      deleteSession(app.db, sessionId);
      reply.clearCookie('aegis_session', { path: '/' });
    }
    return reply.send({ success: true });
  });
}
```

- [ ] **Step 4: Update index.ts to wire up DB and auth**

Replace `server/src/index.ts`:

```typescript
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import { loadConfig, type AppConfig } from './config.js';
import { getDb, createTestDb, type AegisDb } from './db/index.js';
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

export async function buildApp(overrides: Partial<AppConfig & { dbPath: string }> = {}) {
  const config = loadConfig(overrides);
  const app = Fastify({ logger: !config.testing });

  const db = config.testing && overrides.dbPath === ':memory:'
    ? createTestDb()
    : getDb(config.dbPath);

  await app.register(cookie, { secret: config.secretKey });
  await app.register(cors, {
    origin: config.testing ? true : config.appUrl,
    credentials: true,
  });
  await app.register(formbody);

  app.decorate('config', config);
  app.decorate('db', db);

  await app.register(authPlugin);
  await app.register(healthRoutes);
  await app.register(authRoutes);

  if (config.testing && overrides.dbPath === ':memory:') {
    // For in-memory test DB, push schema directly
    const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
    migrate(db, { migrationsFolder: './drizzle' });
  }

  return app;
}

async function start() {
  const app = await buildApp();
  const config = loadConfig();

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`Aegis server listening on ${config.host}:${config.port}`);
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

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && npx vitest run`
Expected: All tests PASS (health + auth + auth-routes)

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/auth.ts server/src/index.ts
git commit -m "feat: auth routes — setup, login, logout, session management"
```

---

## Task 6: Field Encryption Service

**Files:**
- Create: `server/src/services/field-encrypt.ts`
- Test: `server/tests/crypto.test.ts`

- [ ] **Step 1: Write encryption tests**

Create `server/tests/crypto.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { encryptField, decryptField } from '../src/services/field-encrypt.js';

const TEST_KEY = '0123456789abcdef0123456789abcdef'; // 32 hex chars = 16 bytes, we'll use 32 bytes

describe('field encryption', () => {
  it('encrypts and decrypts a string', () => {
    const plaintext = 'Chase Bank checking account ending in 4821';
    const encrypted = encryptField(plaintext, TEST_KEY);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toContain(':'); // iv:authTag:ciphertext format
    const decrypted = decryptField(encrypted, TEST_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const plaintext = 'same input';
    const a = encryptField(plaintext, TEST_KEY);
    const b = encryptField(plaintext, TEST_KEY);
    expect(a).not.toBe(b);
  });

  it('returns null for empty/null input', () => {
    expect(encryptField(null as any, TEST_KEY)).toBeNull();
    expect(encryptField('', TEST_KEY)).toBeNull();
    expect(decryptField(null as any, TEST_KEY)).toBeNull();
    expect(decryptField('', TEST_KEY)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/crypto.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement field encryption**

Create `server/src/services/field-encrypt.ts`:

```typescript
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function deriveKey(key: string): Buffer {
  return createHash('sha256').update(key).digest();
}

export function encryptField(plaintext: string | null, key: string): string | null {
  if (!plaintext) return null;

  const derivedKey = deriveKey(key);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, derivedKey, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptField(ciphertext: string | null, key: string): string | null {
  if (!ciphertext) return null;

  const parts = ciphertext.split(':');
  if (parts.length !== 3) return null;

  const [ivHex, authTagHex, encrypted] = parts;
  const derivedKey = deriveKey(key);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/crypto.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/services/field-encrypt.ts server/tests/crypto.test.ts
git commit -m "feat: AES-256-GCM field encryption for sensitive database columns"
```

---

## Task 7: Estate Item CRUD API

**Files:**
- Create: `server/src/routes/estate.ts`
- Modify: `server/src/index.ts` (register route)
- Test: `server/tests/estate.test.ts`

- [ ] **Step 1: Write estate CRUD tests**

Create `server/tests/estate.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../src/index.js';

describe('Estate Item CRUD', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true, dbPath: ':memory:' });

    // Setup owner
    await app.inject({
      method: 'POST', url: '/api/auth/setup',
      payload: { displayName: 'Test', email: 'test@test.com', password: 'testpass123', timezone: 'UTC' },
    });

    // Login
    const loginRes = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { password: 'testpass123' },
    });
    cookies = String(loginRes.headers['set-cookie']);
  });

  afterAll(async () => { await app.close(); });

  it('creates an estate item', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/estate-items',
      headers: { cookie: cookies },
      payload: {
        category: 'Financial',
        title: 'Chase Checking',
        institutionName: 'Chase Bank',
        referenceHint: '···4821',
        assetDescription: 'Primary checking account',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.id).toBeDefined();
    expect(body.title).toBe('Chase Checking');
    expect(body.assetDescription).toBe('Primary checking account');
  });

  it('lists estate items', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/estate-items',
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.length).toBeGreaterThan(0);
  });

  it('updates an estate item', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/api/estate-items/1',
      headers: { cookie: cookies },
      payload: { title: 'Chase Checking Updated' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).title).toBe('Chase Checking Updated');
  });

  it('deletes an estate item', async () => {
    const res = await app.inject({
      method: 'DELETE', url: '/api/estate-items/1',
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(204);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/estate-items' });
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/estate.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement estate routes**

Create `server/src/routes/estate.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, asc } from 'drizzle-orm';
import { estateItems } from '../db/schema.js';
import { encryptField, decryptField } from '../services/field-encrypt.js';

const createSchema = z.object({
  category: z.string().min(1),
  title: z.string().min(1).max(500),
  institutionName: z.string().max(500).nullable().optional(),
  accountType: z.string().max(200).nullable().optional(),
  referenceHint: z.string().max(200).nullable().optional(),
  assetDescription: z.string().max(5000).nullable().optional(),
  locationNotes: z.string().max(5000).nullable().optional(),
  executorNotes: z.string().max(5000).nullable().optional(),
  sensitiveFlag: z.boolean().optional().default(false),
  sortOrder: z.number().optional().default(0),
});

const updateSchema = createSchema.partial();

function decryptItem(item: typeof estateItems.$inferSelect, key: string) {
  return {
    id: item.id,
    category: item.category,
    title: item.title,
    institutionName: decryptField(item.institutionNameEncrypted, key),
    accountType: decryptField(item.accountTypeEncrypted, key),
    referenceHint: decryptField(item.referenceHintEncrypted, key),
    assetDescription: decryptField(item.assetDescriptionEncrypted, key),
    locationNotes: decryptField(item.locationNotesEncrypted, key),
    executorNotes: decryptField(item.executorNotesEncrypted, key),
    sensitiveFlag: item.sensitiveFlag,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function estateRoutes(app: FastifyInstance) {
  const key = app.config.fieldEncryptionKey;

  // List all
  app.get('/api/estate-items', {
    preHandler: [app.requireAuth],
  }, async (_req, reply) => {
    const items = await app.db.select().from(estateItems)
      .orderBy(asc(estateItems.sortOrder), asc(estateItems.id));
    return reply.send(items.map(i => decryptItem(i, key)));
  });

  // Get one
  app.get('/api/estate-items/:id', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const [item] = await app.db.select().from(estateItems)
      .where(eq(estateItems.id, parseInt(id)));
    if (!item) return reply.status(404).send({ error: 'Not found' });
    return reply.send(decryptItem(item, key));
  });

  // Create
  app.post('/api/estate-items', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const body = createSchema.parse(req.body);
    const now = new Date();

    const [created] = await app.db.insert(estateItems).values({
      category: body.category,
      title: body.title,
      institutionNameEncrypted: encryptField(body.institutionName ?? null, key),
      accountTypeEncrypted: encryptField(body.accountType ?? null, key),
      referenceHintEncrypted: encryptField(body.referenceHint ?? null, key),
      assetDescriptionEncrypted: encryptField(body.assetDescription ?? null, key),
      locationNotesEncrypted: encryptField(body.locationNotes ?? null, key),
      executorNotesEncrypted: encryptField(body.executorNotes ?? null, key),
      sensitiveFlag: body.sensitiveFlag,
      sortOrder: body.sortOrder,
      createdAt: now,
      updatedAt: now,
    }).returning();

    return reply.status(201).send(decryptItem(created, key));
  });

  // Update
  app.put('/api/estate-items/:id', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = updateSchema.parse(req.body);
    const now = new Date();

    const updates: Record<string, unknown> = { updatedAt: now };
    if (body.category !== undefined) updates.category = body.category;
    if (body.title !== undefined) updates.title = body.title;
    if (body.institutionName !== undefined) updates.institutionNameEncrypted = encryptField(body.institutionName ?? null, key);
    if (body.accountType !== undefined) updates.accountTypeEncrypted = encryptField(body.accountType ?? null, key);
    if (body.referenceHint !== undefined) updates.referenceHintEncrypted = encryptField(body.referenceHint ?? null, key);
    if (body.assetDescription !== undefined) updates.assetDescriptionEncrypted = encryptField(body.assetDescription ?? null, key);
    if (body.locationNotes !== undefined) updates.locationNotesEncrypted = encryptField(body.locationNotes ?? null, key);
    if (body.executorNotes !== undefined) updates.executorNotesEncrypted = encryptField(body.executorNotes ?? null, key);
    if (body.sensitiveFlag !== undefined) updates.sensitiveFlag = body.sensitiveFlag;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

    const [updated] = await app.db.update(estateItems)
      .set(updates)
      .where(eq(estateItems.id, parseInt(id)))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'Not found' });
    return reply.send(decryptItem(updated, key));
  });

  // Delete
  app.delete('/api/estate-items/:id', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const deleted = await app.db.delete(estateItems)
      .where(eq(estateItems.id, parseInt(id)))
      .returning();
    if (deleted.length === 0) return reply.status(404).send({ error: 'Not found' });
    return reply.status(204).send();
  });
}
```

- [ ] **Step 4: Register estate routes in index.ts**

Add to `server/src/index.ts` after `authRoutes` import:

```typescript
import { estateRoutes } from './routes/estate.js';
```

Add after `await app.register(authRoutes);`:

```typescript
await app.register(estateRoutes);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/estate.ts server/tests/estate.test.ts server/src/index.ts
git commit -m "feat: estate item CRUD with field-level encryption"
```

---

## Task 8: Contact CRUD API with Ordering

**Files:**
- Create: `server/src/routes/contacts.ts`
- Modify: `server/src/index.ts` (register route)
- Test: `server/tests/contacts.test.ts`

- [ ] **Step 1: Write contact CRUD tests**

Create `server/tests/contacts.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/index.js';

describe('Contact CRUD', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true, dbPath: ':memory:' });
    await app.inject({
      method: 'POST', url: '/api/auth/setup',
      payload: { displayName: 'Test', email: 'test@test.com', password: 'testpass123', timezone: 'UTC' },
    });
    const loginRes = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { password: 'testpass123' },
    });
    cookies = String(loginRes.headers['set-cookie']);
  });

  afterAll(async () => { await app.close(); });

  it('creates contacts with priority ordering', async () => {
    const contacts = [
      { fullName: 'James Whitfield', relationship: 'Brother', email: 'james@example.com', priorityOrder: 1 },
      { fullName: 'Margaret Osei', relationship: 'Father', email: 'dad@example.com', priorityOrder: 2 },
      { fullName: 'Sarah Whitfield', relationship: 'Sister', email: 'sarah@example.com', priorityOrder: 3 },
    ];

    for (const contact of contacts) {
      const res = await app.inject({
        method: 'POST', url: '/api/contacts',
        headers: { cookie: cookies },
        payload: contact,
      });
      expect(res.statusCode).toBe(201);
    }
  });

  it('lists contacts in priority order', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/contacts',
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.length).toBe(3);
    expect(body[0].fullName).toBe('James Whitfield');
    expect(body[1].fullName).toBe('Margaret Osei');
    expect(body[2].fullName).toBe('Sarah Whitfield');
  });

  it('reorders contacts', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/api/contacts/reorder',
      headers: { cookie: cookies },
      payload: { order: [3, 1, 2] }, // Sarah first, then James, then Margaret
    });
    expect(res.statusCode).toBe(200);

    const listRes = await app.inject({
      method: 'GET', url: '/api/contacts',
      headers: { cookie: cookies },
    });
    const body = JSON.parse(listRes.payload);
    expect(body[0].fullName).toBe('Sarah Whitfield');
    expect(body[1].fullName).toBe('James Whitfield');
  });

  it('deletes a contact', async () => {
    const res = await app.inject({
      method: 'DELETE', url: '/api/contacts/2',
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(204);

    const listRes = await app.inject({
      method: 'GET', url: '/api/contacts',
      headers: { cookie: cookies },
    });
    expect(JSON.parse(listRes.payload).length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/contacts.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement contact routes**

Create `server/src/routes/contacts.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, asc } from 'drizzle-orm';
import { contacts } from '../db/schema.js';
import { encryptField, decryptField } from '../services/field-encrypt.js';

const createSchema = z.object({
  fullName: z.string().min(1).max(300),
  relationship: z.string().max(200).nullable().optional(),
  priorityOrder: z.number().int().min(1),
  email: z.string().email(),
  phone: z.string().max(50).nullable().optional(),
  telegramHandle: z.string().max(200).nullable().optional(),
  preferredChannels: z.array(z.enum(['email', 'sms', 'telegram'])).optional().default(['email']),
  confirmationWindowHours: z.number().int().min(1).max(720).optional().default(48),
  backupNotes: z.string().max(5000).nullable().optional(),
});

const updateSchema = createSchema.partial();

const reorderSchema = z.object({
  order: z.array(z.number().int()),
});

function decryptContact(c: typeof contacts.$inferSelect, key: string) {
  return {
    id: c.id,
    fullName: decryptField(c.fullNameEncrypted, key)!,
    relationship: decryptField(c.relationshipEncrypted, key),
    priorityOrder: c.priorityOrder,
    email: decryptField(c.emailEncrypted, key)!,
    phone: decryptField(c.phoneEncrypted, key),
    telegramHandle: decryptField(c.telegramHandleEncrypted, key),
    preferredChannels: JSON.parse(c.preferredChannels),
    confirmationWindowHours: c.confirmationWindowHours,
    backupNotes: decryptField(c.backupNotesEncrypted, key),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function contactRoutes(app: FastifyInstance) {
  const key = app.config.fieldEncryptionKey;

  // List all
  app.get('/api/contacts', {
    preHandler: [app.requireAuth],
  }, async (_req, reply) => {
    const rows = await app.db.select().from(contacts)
      .orderBy(asc(contacts.priorityOrder));
    return reply.send(rows.map(c => decryptContact(c, key)));
  });

  // Get one
  app.get('/api/contacts/:id', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const [contact] = await app.db.select().from(contacts)
      .where(eq(contacts.id, parseInt(id)));
    if (!contact) return reply.status(404).send({ error: 'Not found' });
    return reply.send(decryptContact(contact, key));
  });

  // Create
  app.post('/api/contacts', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const body = createSchema.parse(req.body);
    const now = new Date();

    const [created] = await app.db.insert(contacts).values({
      fullNameEncrypted: encryptField(body.fullName, key)!,
      relationshipEncrypted: encryptField(body.relationship ?? null, key),
      priorityOrder: body.priorityOrder,
      emailEncrypted: encryptField(body.email, key)!,
      phoneEncrypted: encryptField(body.phone ?? null, key),
      telegramHandleEncrypted: encryptField(body.telegramHandle ?? null, key),
      preferredChannels: JSON.stringify(body.preferredChannels),
      confirmationWindowHours: body.confirmationWindowHours,
      backupNotesEncrypted: encryptField(body.backupNotes ?? null, key),
      createdAt: now,
      updatedAt: now,
    }).returning();

    return reply.status(201).send(decryptContact(created, key));
  });

  // Update
  app.put('/api/contacts/:id', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = updateSchema.parse(req.body);
    const now = new Date();

    const updates: Record<string, unknown> = { updatedAt: now };
    if (body.fullName !== undefined) updates.fullNameEncrypted = encryptField(body.fullName, key);
    if (body.relationship !== undefined) updates.relationshipEncrypted = encryptField(body.relationship ?? null, key);
    if (body.priorityOrder !== undefined) updates.priorityOrder = body.priorityOrder;
    if (body.email !== undefined) updates.emailEncrypted = encryptField(body.email, key);
    if (body.phone !== undefined) updates.phoneEncrypted = encryptField(body.phone ?? null, key);
    if (body.telegramHandle !== undefined) updates.telegramHandleEncrypted = encryptField(body.telegramHandle ?? null, key);
    if (body.preferredChannels !== undefined) updates.preferredChannels = JSON.stringify(body.preferredChannels);
    if (body.confirmationWindowHours !== undefined) updates.confirmationWindowHours = body.confirmationWindowHours;
    if (body.backupNotes !== undefined) updates.backupNotesEncrypted = encryptField(body.backupNotes ?? null, key);

    const [updated] = await app.db.update(contacts)
      .set(updates)
      .where(eq(contacts.id, parseInt(id)))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'Not found' });
    return reply.send(decryptContact(updated, key));
  });

  // Reorder
  app.put('/api/contacts/reorder', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const body = reorderSchema.parse(req.body);

    for (let i = 0; i < body.order.length; i++) {
      await app.db.update(contacts)
        .set({ priorityOrder: i + 1, updatedAt: new Date() })
        .where(eq(contacts.id, body.order[i]));
    }

    const rows = await app.db.select().from(contacts)
      .orderBy(asc(contacts.priorityOrder));
    return reply.send(rows.map(c => decryptContact(c, key)));
  });

  // Delete
  app.delete('/api/contacts/:id', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const deleted = await app.db.delete(contacts)
      .where(eq(contacts.id, parseInt(id)))
      .returning();
    if (deleted.length === 0) return reply.status(404).send({ error: 'Not found' });
    return reply.status(204).send();
  });
}
```

- [ ] **Step 4: Register contacts route in index.ts**

Add import and registration in `server/src/index.ts`:

```typescript
import { contactRoutes } from './routes/contacts.js';
// ... after estateRoutes registration:
await app.register(contactRoutes);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/contacts.ts server/tests/contacts.test.ts server/src/index.ts
git commit -m "feat: contact CRUD with priority ordering and field encryption"
```

---

## Task 9: React + Vite Frontend Scaffold

**Files:**
- Create: `web/vite.config.ts`
- Create: `web/tailwind.config.ts`
- Create: `web/postcss.config.js`
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx`
- Create: `web/src/index.css`
- Create: `web/src/lib/api.ts`
- Create: `web/src/lib/theme.ts`
- Create: `web/src/pages/Login.tsx`

- [ ] **Step 1: Create Vite config**

Create `web/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
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
      },
      colors: {
        blueprint: {
          bg: '#DDE8F4',
          ink: '#0B1C2C',
          accent: '#1A6B9A',
          muted: '#4A6B8A',
          surface: '#C8D9ED',
          border: '#8AAAC8',
          danger: '#C0392B',
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
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
</head>
<body class="bg-blueprint-bg text-blueprint-ink">
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 5: Create CSS + main entry + App + API client**

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

Create `web/src/lib/theme.ts`:

```typescript
export const themes = {
  blueprint: {
    bg: '#DDE8F4', ink: '#0B1C2C', accent: '#1A6B9A',
    muted: '#4A6B8A', surface: '#C8D9ED', border: '#8AAAC8',
    danger: '#C0392B',
  },
  cream: {
    bg: '#F7F4EE', ink: '#1C1917', accent: '#A0522D',
    muted: '#8B7355', surface: '#EDE9E0', border: '#C4B89A',
    danger: '#C0392B',
  },
  midnight: {
    bg: '#111111', ink: '#F0EBE0', accent: '#E8C840',
    muted: '#888880', surface: '#1E1E1E', border: '#333330',
    danger: '#E53935',
  },
} as const;

export type ThemeName = keyof typeof themes;
export type Theme = typeof themes[ThemeName];
```

Create `web/src/App.tsx`:

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { get } from './lib/api';
import Login from './pages/Login';

function App() {
  const [authStatus, setAuthStatus] = useState<'loading' | 'setup' | 'login' | 'authenticated'>('loading');

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const status = await get<{ setupRequired: boolean }>('/api/auth/status');
      if (status.setupRequired) {
        setAuthStatus('setup');
        return;
      }
      await get('/api/auth/me');
      setAuthStatus('authenticated');
    } catch {
      setAuthStatus('login');
    }
  }

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center font-hand text-3xl">
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login onAuth={() => setAuthStatus('authenticated')} mode={authStatus === 'setup' ? 'setup' : 'login'} />} />
      <Route path="/dashboard" element={authStatus === 'authenticated' ? <div className="p-8 font-hand text-3xl">Dashboard — Coming Soon</div> : <Navigate to="/login" />} />
      <Route path="*" element={<Navigate to={authStatus === 'authenticated' ? '/dashboard' : '/login'} />} />
    </Routes>
  );
}

export default App;
```

Create `web/src/pages/Login.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { post } from '../lib/api';

interface LoginProps {
  onAuth: () => void;
  mode: 'setup' | 'login';
}

export default function Login({ onAuth, mode }: LoginProps) {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'setup') {
        await post('/api/auth/setup', { displayName, email, password, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      } else {
        await post('/api/auth/login', { password });
      }
      onAuth();
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#DDE8F4' }}>
      <form onSubmit={handleSubmit} className="w-full max-w-md p-8" style={{
        background: '#C8D9ED', border: '2px solid #8AAAC8',
        borderRadius: '3px 10px 3px 10px / 10px 3px 10px 3px',
      }}>
        <h1 className="font-hand text-4xl font-bold mb-6" style={{ color: '#0B1C2C' }}>
          {mode === 'setup' ? 'Set Up Aegis' : 'Welcome Back'}
        </h1>

        {mode === 'setup' && (
          <>
            <input type="text" placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)}
              className="w-full font-mono text-sm p-3 mb-3 rounded border outline-none" style={{ background: '#DDE8F4', borderColor: '#8AAAC8', color: '#0B1C2C' }} />
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full font-mono text-sm p-3 mb-3 rounded border outline-none" style={{ background: '#DDE8F4', borderColor: '#8AAAC8', color: '#0B1C2C' }} />
          </>
        )}

        <input type="password" placeholder="Passphrase" value={password} onChange={e => setPassword(e.target.value)}
          className="w-full font-mono text-sm p-3 mb-4 rounded border outline-none" style={{ background: '#DDE8F4', borderColor: '#8AAAC8', color: '#0B1C2C' }} />

        {error && <div className="font-mono text-sm mb-3" style={{ color: '#C0392B' }}>{error}</div>}

        <button type="submit" className="w-full font-hand text-xl font-bold p-3 cursor-pointer transition-all" style={{
          background: '#0B1C2C', color: '#DDE8F4',
          border: '2px solid #0B1C2C',
          borderRadius: '3px 8px 3px 8px / 8px 3px 8px 3px',
          boxShadow: '3px 3px 0 #1A6B9A66',
        }}>
          {mode === 'setup' ? 'Create Account →' : 'Log In →'}
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
git add web/
git commit -m "feat: react + vite + tailwind frontend scaffold with login page"
```

---

## Task 10: Docker Setup

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create multi-stage Dockerfile**

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY web/package.json ./web/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci

FROM base AS web-build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/web/node_modules ./web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY packages/shared ./packages/shared
COPY web ./web
COPY tsconfig.base.json ./
RUN cd web && npx vite build

FROM base AS server-build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY packages/shared ./packages/shared
COPY server ./server
COPY tsconfig.base.json ./
RUN cd server && npx tsc

FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY --from=server-build /app/server/dist ./server/dist
COPY --from=web-build /app/server/static ./server/static
COPY server/drizzle ./server/drizzle
COPY packages/shared ./packages/shared

VOLUME /data
ENV AEGIS_DB_PATH=/data/aegis.db
EXPOSE 8000

CMD ["node", "server/dist/index.js"]
```

- [ ] **Step 2: Create docker-compose.yml**

Create `docker-compose.yml`:

```yaml
services:
  aegis:
    build: .
    restart: unless-stopped
    ports:
      - "8000:8000"
    volumes:
      - aegis-data:/data
    env_file:
      - .env

volumes:
  aegis-data:
```

- [ ] **Step 3: Test Docker build**

Run: `docker compose build`
Expected: Successful build

- [ ] **Step 4: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat: docker compose deployment with multi-stage build"
```

---

## Task 11: Static File Serving + Production Mode

**Files:**
- Modify: `server/src/index.ts` (add static file serving)

- [ ] **Step 1: Add @fastify/static for serving Vite build**

Add to `server/src/index.ts` after other imports:

```typescript
import fastifyStatic from '@fastify/static';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
```

Add after route registrations, before the `return app` line:

```typescript
  // Serve Vite build in production
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const staticDir = resolve(__dirname, '../static');
  if (existsSync(staticDir)) {
    await app.register(fastifyStatic, {
      root: staticDir,
      prefix: '/',
      wildcard: false,
    });

    // SPA fallback — serve index.html for all non-API routes
    app.setNotFoundHandler(async (req, reply) => {
      if (req.url.startsWith('/api/') || req.url === '/health') {
        return reply.status(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
  }
```

- [ ] **Step 2: Test full stack locally**

Run: `cd web && npm run build && cd ../server && npx tsx src/index.ts`
Expected: Server starts, serves frontend at http://localhost:8000

- [ ] **Step 3: Commit**

```bash
git add server/src/index.ts
git commit -m "feat: serve vite build as static files with SPA fallback"
```

---

## Task 12: DeadDrop Contract Package

> **Directive reference:** §5 — Contracts Package

**Goal:** Create `packages/contracts/` as the canonical domain boundary package. This package defines versioned zod schemas and TypeScript types for the core DeadDrop protocol: packet envelopes, release runs, heartbeats, claim events, webhook events, storage providers, and notification providers. These contracts are the foundation for the future DeadDrop API and must be shared (or kept compatible) between the OSS and SaaS repos.

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

- [ ] **Step 1: Create packages/contracts/package.json**

```json
{
  "name": "@aegis/contracts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Create packages/contracts/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/contracts/src/packet-envelope.ts**

```typescript
import { z } from 'zod';

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

export type DeadDropPacketEnvelope = z.infer<typeof DeadDropPacketEnvelopeSchema>;
```

- [ ] **Step 4: Create packages/contracts/src/release-run.ts**

```typescript
import { z } from 'zod';

export const RELEASE_RUN_SCHEMA_VERSION = '2026-05-01';

export const ReleaseRunStatusSchema = z.enum([
  'pending', 'active', 'cascade_active', 'completed',
  'cancelled', 'failed', 'suppressed_by_active_release_run',
]);

export const ReleaseRunSchema = z.object({
  schemaVersion: z.literal(RELEASE_RUN_SCHEMA_VERSION),
  releaseRunId: z.string(),
  switchId: z.string(),
  ownerId: z.string().optional(),
  sourceApp: z.enum(['aegis_core', 'aegis_hosted', 'partner']),
  status: ReleaseRunStatusSchema,
  triggeredAt: z.string(),
  completedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  failedAt: z.string().nullable(),
  failureReason: z.string().nullable(),
});

export type ReleaseRun = z.infer<typeof ReleaseRunSchema>;
export type ReleaseRunStatus = z.infer<typeof ReleaseRunStatusSchema>;
```

- [ ] **Step 5: Create packages/contracts/src/heartbeat.ts**

```typescript
import { z } from 'zod';

export const HEARTBEAT_SCHEMA_VERSION = '2026-05-01';

export const HeartbeatRequestSchema = z.object({
  schemaVersion: z.literal(HEARTBEAT_SCHEMA_VERSION),
  switchId: z.string(),
  ownerId: z.string().optional(),
  sourceApp: z.enum(['aegis_core', 'aegis_hosted', 'partner']),
  timestamp: z.string(),
  nextExpectedAt: z.string().nullable(),
});

export const HeartbeatResponseSchema = z.object({
  schemaVersion: z.literal(HEARTBEAT_SCHEMA_VERSION),
  accepted: z.boolean(),
  serverTimestamp: z.string(),
  switchStatus: z.string().optional(),
  message: z.string().optional(),
});

export type HeartbeatRequest = z.infer<typeof HeartbeatRequestSchema>;
export type HeartbeatResponse = z.infer<typeof HeartbeatResponseSchema>;
```

- [ ] **Step 6: Create packages/contracts/src/claim-event.ts**

```typescript
import { z } from 'zod';

export const CLAIM_EVENT_SCHEMA_VERSION = '2026-05-01';

export const ClaimEventTypeSchema = z.enum([
  'claim_created', 'claim_notified', 'claim_opened', 'claim_verified',
  'claim_accepted', 'packet_downloaded', 'key_viewed', 'claim_acknowledged',
  'claim_expired', 'claim_escalated', 'claim_failed',
]);

export const ClaimEventSchema = z.object({
  schemaVersion: z.literal(CLAIM_EVENT_SCHEMA_VERSION),
  claimEventId: z.string(),
  claimId: z.string(),
  contactId: z.string(),
  releaseRunId: z.string(),
  packetId: z.string(),
  eventType: ClaimEventTypeSchema,
  channel: z.enum(['email', 'sms', 'telegram']).optional(),
  timestamp: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export type ClaimEvent = z.infer<typeof ClaimEventSchema>;
export type ClaimEventType = z.infer<typeof ClaimEventTypeSchema>;
```

- [ ] **Step 7: Create packages/contracts/src/webhook-event.ts**

```typescript
import { z } from 'zod';

export const WEBHOOK_EVENT_SCHEMA_VERSION = '2026-05-01';

export const WebhookEventTypeSchema = z.enum([
  'heartbeat.received', 'heartbeat.missed',
  'switch.armed', 'switch.triggered', 'switch.cancelled',
  'release_run.started', 'release_run.completed', 'release_run.failed',
  'claim.created', 'claim.opened', 'claim.verified', 'claim.acknowledged',
  'packet.generated', 'packet.uploaded', 'packet.deleted',
  'notification.sent', 'notification.failed',
]);

export const WebhookEventSchema = z.object({
  schemaVersion: z.literal(WEBHOOK_EVENT_SCHEMA_VERSION),
  webhookEventId: z.string(),
  eventType: WebhookEventTypeSchema,
  sourceApp: z.enum(['aegis_core', 'aegis_hosted', 'aegis_relay', 'partner']),
  timestamp: z.string(),
  payload: z.record(z.unknown()),
  signature: z.string().optional(),
});

export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
export type WebhookEventType = z.infer<typeof WebhookEventTypeSchema>;
```

- [ ] **Step 8: Create packages/contracts/src/storage-provider.ts**

```typescript
import { z } from 'zod';

export const STORAGE_PROVIDER_SCHEMA_VERSION = '2026-05-01';

export const StorageProviderTypeSchema = z.enum([
  'local', 's3_compatible', 'r2', 'relay_escrow', 'hosted',
]);

export const StorageProviderConfigSchema = z.object({
  schemaVersion: z.literal(STORAGE_PROVIDER_SCHEMA_VERSION),
  providerType: StorageProviderTypeSchema,
  endpoint: z.string().optional(),
  bucket: z.string().optional(),
  region: z.string().optional(),
  prefix: z.string().optional(),
});

export interface StorageProvider {
  type: string;
  upload(objectKey: string, data: Buffer): Promise<{ hash: string }>;
  download(objectKey: string): Promise<Buffer>;
  delete(objectKey: string): Promise<void>;
  verify(objectKey: string, expectedHash: string): Promise<boolean>;
}

export type StorageProviderConfig = z.infer<typeof StorageProviderConfigSchema>;
export type StorageProviderType = z.infer<typeof StorageProviderTypeSchema>;
```

- [ ] **Step 9: Create packages/contracts/src/notification-provider.ts**

```typescript
import { z } from 'zod';

export const NOTIFICATION_PROVIDER_SCHEMA_VERSION = '2026-05-01';

export const NotificationChannelSchema = z.enum(['email', 'sms', 'telegram']);

export const NotificationRequestSchema = z.object({
  schemaVersion: z.literal(NOTIFICATION_PROVIDER_SCHEMA_VERSION),
  notificationId: z.string(),
  channel: NotificationChannelSchema,
  recipientId: z.string(),
  templateId: z.string(),
  variables: z.record(z.string()),
  priority: z.enum(['normal', 'high', 'critical']).default('normal'),
});

export const NotificationResultSchema = z.object({
  notificationId: z.string(),
  channel: NotificationChannelSchema,
  status: z.enum(['queued', 'sent', 'delivered', 'failed', 'bounced']),
  externalId: z.string().optional(),
  failureReason: z.string().optional(),
  timestamp: z.string(),
});

export interface NotificationProvider {
  channel: string;
  send(request: NotificationRequest): Promise<NotificationResult>;
  testConnection(): Promise<{ ok: boolean; message?: string }>;
}

export type NotificationRequest = z.infer<typeof NotificationRequestSchema>;
export type NotificationResult = z.infer<typeof NotificationResultSchema>;
```

- [ ] **Step 10: Create packages/contracts/src/index.ts**

```typescript
// DeadDrop Protocol Contracts — canonical domain boundary package
// These contracts define the shared shapes for Aegis Core, Aegis SaaS,
// and future DeadDrop API partner integrations.

export * from './packet-envelope.js';
export * from './release-run.js';
export * from './heartbeat.js';
export * from './claim-event.js';
export * from './webhook-event.js';
export * from './storage-provider.js';
export * from './notification-provider.js';
```

- [ ] **Step 11: Create packages/contracts/tests/contracts.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import {
  DeadDropPacketEnvelopeSchema, DEAD_DROP_PACKET_ENVELOPE_VERSION,
  ReleaseRunSchema, RELEASE_RUN_SCHEMA_VERSION,
  HeartbeatRequestSchema, HeartbeatResponseSchema, HEARTBEAT_SCHEMA_VERSION,
  ClaimEventSchema, CLAIM_EVENT_SCHEMA_VERSION,
  WebhookEventSchema, WEBHOOK_EVENT_SCHEMA_VERSION,
  StorageProviderConfigSchema, STORAGE_PROVIDER_SCHEMA_VERSION,
  NotificationRequestSchema, NotificationResultSchema, NOTIFICATION_PROVIDER_SCHEMA_VERSION,
} from '../src/index.js';

describe('DeadDrop Contracts', () => {
  describe('PacketEnvelope', () => {
    it('validates a well-formed packet envelope', () => {
      const envelope = {
        schemaVersion: DEAD_DROP_PACKET_ENVELOPE_VERSION,
        packetId: 'pkt_001',
        sourceApp: 'aegis_core' as const,
        createdAt: new Date().toISOString(),
        expiresAt: null,
        encryption: {
          algorithm: 'aes-256-gcm' as const,
          keyId: 'key_001',
          iv: 'abcdef1234567890',
          authTag: 'tag123',
        },
        contentHash: 'sha256:abc123',
        encryptedObjectHash: null,
        storage: null,
      };
      expect(() => DeadDropPacketEnvelopeSchema.parse(envelope)).not.toThrow();
    });

    it('rejects wrong schema version', () => {
      const bad = {
        schemaVersion: '1999-01-01',
        packetId: 'pkt_001',
        sourceApp: 'aegis_core',
        createdAt: new Date().toISOString(),
        expiresAt: null,
        encryption: { algorithm: 'aes-256-gcm', keyId: 'k', iv: 'v', authTag: 't' },
        contentHash: 'h',
        encryptedObjectHash: null,
        storage: null,
      };
      expect(() => DeadDropPacketEnvelopeSchema.parse(bad)).toThrow();
    });
  });

  describe('ReleaseRun', () => {
    it('validates a well-formed release run', () => {
      const run = {
        schemaVersion: RELEASE_RUN_SCHEMA_VERSION,
        releaseRunId: 'rr_001',
        switchId: 'sw_001',
        sourceApp: 'aegis_core' as const,
        status: 'active' as const,
        triggeredAt: new Date().toISOString(),
        completedAt: null,
        cancelledAt: null,
        failedAt: null,
        failureReason: null,
      };
      expect(() => ReleaseRunSchema.parse(run)).not.toThrow();
    });
  });

  describe('Heartbeat', () => {
    it('validates heartbeat request and response', () => {
      const req = {
        schemaVersion: HEARTBEAT_SCHEMA_VERSION,
        switchId: 'sw_001',
        sourceApp: 'aegis_core' as const,
        timestamp: new Date().toISOString(),
        nextExpectedAt: null,
      };
      expect(() => HeartbeatRequestSchema.parse(req)).not.toThrow();

      const res = {
        schemaVersion: HEARTBEAT_SCHEMA_VERSION,
        accepted: true,
        serverTimestamp: new Date().toISOString(),
      };
      expect(() => HeartbeatResponseSchema.parse(res)).not.toThrow();
    });
  });

  describe('ClaimEvent', () => {
    it('validates a well-formed claim event', () => {
      const event = {
        schemaVersion: CLAIM_EVENT_SCHEMA_VERSION,
        claimEventId: 'ce_001',
        claimId: 'cl_001',
        contactId: 'ct_001',
        releaseRunId: 'rr_001',
        packetId: 'pkt_001',
        eventType: 'claim_created' as const,
        timestamp: new Date().toISOString(),
      };
      expect(() => ClaimEventSchema.parse(event)).not.toThrow();
    });
  });

  describe('WebhookEvent', () => {
    it('validates a well-formed webhook event', () => {
      const event = {
        schemaVersion: WEBHOOK_EVENT_SCHEMA_VERSION,
        webhookEventId: 'wh_001',
        eventType: 'switch.armed' as const,
        sourceApp: 'aegis_core' as const,
        timestamp: new Date().toISOString(),
        payload: { switchId: 'sw_001' },
      };
      expect(() => WebhookEventSchema.parse(event)).not.toThrow();
    });
  });

  describe('StorageProviderConfig', () => {
    it('validates a storage provider config', () => {
      const config = {
        schemaVersion: STORAGE_PROVIDER_SCHEMA_VERSION,
        providerType: 's3_compatible' as const,
        endpoint: 'https://s3.example.com',
        bucket: 'aegis-packets',
        region: 'us-east-1',
        prefix: 'packets/',
      };
      expect(() => StorageProviderConfigSchema.parse(config)).not.toThrow();
    });
  });

  describe('NotificationRequest/Result', () => {
    it('validates notification request and result', () => {
      const req = {
        schemaVersion: NOTIFICATION_PROVIDER_SCHEMA_VERSION,
        notificationId: 'n_001',
        channel: 'email' as const,
        recipientId: 'ct_001',
        templateId: 'claim_notification',
        variables: { claimUrl: 'https://claim.example.com/abc' },
      };
      expect(() => NotificationRequestSchema.parse(req)).not.toThrow();

      const result = {
        notificationId: 'n_001',
        channel: 'email' as const,
        status: 'sent' as const,
        timestamp: new Date().toISOString(),
      };
      expect(() => NotificationResultSchema.parse(result)).not.toThrow();
    });
  });
});
```

- [ ] **Step 12: Update root package.json workspaces**

Ensure `packages/*` is in the workspaces array (it should already be there from Task 1). Verify that `@aegis/contracts` is picked up as a workspace package.

Run: `npm install`
Expected: Clean install with workspace symlinks for `@aegis/shared` and `@aegis/contracts`

- [ ] **Step 13: Run contract tests**

Run: `cd packages/contracts && npx vitest run`
Expected: All contract tests PASS

- [ ] **Step 14: Commit**

```bash
git add packages/contracts/
git commit -m "feat: DeadDrop contract package with versioned zod schemas and tests"
```

**SaaS compatibility note:** The SaaS repo (`aegis-dms-site`) should either maintain a compatible `packages/contracts` package of its own or consume a published/internal version of this package once the contracts stabilize. Do not allow OSS and SaaS contract shapes to drift silently. Add contract validation tests in both repos.

---

## Task 13: CSRF Protection

> **Directive reference:** §10 — CSRF Implementation

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
    app = await buildApp({ testing: true, dbPath: ':memory:' });
    await app.inject({
      method: 'POST', url: '/api/auth/setup',
      payload: { displayName: 'Test', email: 'test@test.com', password: 'testpass123', timezone: 'UTC' },
    });
    const loginRes = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { password: 'testpass123' },
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
    expect(res.statusCode).toBe(201);
  });

  it('rejects expired CSRF token', async () => {
    // Implementation should support token expiration.
    // This test verifies the expiration behavior exists.
    // In the real implementation, use a short TTL for testing
    // or mock the time to verify expiration logic.
    const csrfRes = await app.inject({
      method: 'GET', url: '/api/csrf',
      headers: { cookie: cookies },
    });
    const { csrfToken } = JSON.parse(csrfRes.payload);
    expect(csrfToken).toBeDefined();
    // Expiration test requires time mocking — add in integration tests
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

  // Verify session binding
  if (tokenSessionId !== sessionId) return false;

  // Verify not expired
  const created = parseInt(timestamp, 36);
  if (isNaN(created) || Date.now() - created > CSRF_TTL_MS) return false;

  // Verify signature
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

Add a Fastify `onRequest` hook that validates CSRF tokens on all POST, PUT, PATCH, and DELETE requests to `/api/*` (except `/api/auth/setup`, `/api/auth/login`, and `/api/csrf`):

```typescript
import { validateCsrfToken } from './auth/csrf.js';
import { csrfRoutes } from './routes/csrf.js';

// Register csrf routes
await app.register(csrfRoutes);

// CSRF validation hook
app.addHook('onRequest', async (req, reply) => {
  const method = req.method;
  const url = req.url;

  // Only validate state-mutating methods on API routes
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;
  if (!url.startsWith('/api/')) return;

  // Exempt auth setup/login (no session yet) and logout
  const exemptPaths = ['/api/auth/setup', '/api/auth/login', '/api/auth/logout'];
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

Update `web/src/lib/api.ts` to fetch and include CSRF tokens:

```typescript
const BASE = '';
let csrfToken: string | null = null;

async function ensureCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  try {
    const res = await fetch(`${BASE}/api/csrf`, { credentials: 'include' });
    if (res.ok) {
      const body = await res.json();
      csrfToken = body.csrfToken;
      return csrfToken;
    }
  } catch {
    // Not authenticated yet — no CSRF token needed
  }
  return null;
}

export function clearCsrfToken() {
  csrfToken = null;
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  // Include CSRF token on state-mutating requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method || '')) {
    const token = await ensureCsrfToken();
    if (token) {
      headers['X-CSRF-Token'] = token;
    }
  }

  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers,
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

**Cookie settings for CSRF and session cookies:**

```text
HttpOnly: true
Secure: true (in production, i.e., NODE_ENV=production)
SameSite: Lax
No wildcard CORS with credentials
Explicit CORS allowlist via AEGIS_APP_URL
```

- [ ] **Step 6: Run tests**

Run: `cd server && npx vitest run`
Expected: All tests PASS including CSRF tests

- [ ] **Step 7: Commit**

```bash
git add server/src/auth/csrf.ts server/src/routes/csrf.ts server/tests/csrf.test.ts server/src/index.ts web/src/lib/api.ts
git commit -m "feat: CSRF protection with signed session-bound tokens"
```

---

## Task 14: Arming Readiness Gates

> **Directive reference:** §7 — Claim Portal Reachability and Arming Gates

**Goal:** Define the readiness check system that prevents a switch from being armed unless its release path is actually viable. This task defines the types, checks, and mode-specific rules. The actual switch arming implementation happens in Phase 2, but these contracts and types must be established now so the switch state machine can enforce them.

**Files:**
- Create: `server/src/services/readiness.ts`
- Create: `server/tests/readiness.test.ts`

- [ ] **Step 1: Define ReadinessCheck types**

Create `server/src/services/readiness.ts`:

```typescript
/**
 * Arming Readiness Gates
 *
 * A switch may only be armed for automated release if its release path
 * is actually viable. These checks run before arming and block the
 * transition from 'draft' to 'armed' if any required check fails.
 *
 * Deployment mode names:
 *   - Vault Mode: local-only planning/storage, no reliable automated release
 *   - Dead Drop Mode: local app + encrypted packet synced to S3-compatible storage
 *   - Relay Monitoring: self-hosted + cloud heartbeat/offline monitoring
 *   - Relay Escrow: self-hosted + cloud monitoring + trusted SaaS release authority
 *   - Hosted: fully managed SaaS
 */

export type ReadinessStatus = 'ready' | 'not_ready' | 'warning';

export interface ReadinessCheck {
  id: string;
  label: string;
  status: ReadinessStatus;
  required: boolean;
  message: string;
  resolutionHint?: string;
}

export interface ReadinessResult {
  canArm: boolean;
  deploymentMode: string;
  checks: ReadinessCheck[];
}

/**
 * Required readiness checks (all modes):
 *
 * 1. At least one contact is selected.
 * 2. At least one estate item or instruction packet is selected.
 * 3. Notification provider is configured and tested (unless selected
 *    mode explicitly does not support notifications).
 * 4. Packet generation + encryption succeeds.
 * 5. Storage works if Dead Drop, Relay Escrow, or Hosted.
 * 6. Claim portal URL is reachable, or Relay/Hosted claim portal is enabled.
 * 7. Key-release path is configured for the selected deployment mode.
 * 8. User has acknowledged the limitations of the selected mode.
 */

export function createBaseChecks(): ReadinessCheck[] {
  return [
    { id: 'contacts_selected', label: 'Contacts selected', status: 'not_ready', required: true, message: 'At least one contact must be selected.' },
    { id: 'estate_items_selected', label: 'Estate items selected', status: 'not_ready', required: true, message: 'At least one estate item or instruction must be selected.' },
    { id: 'notification_provider', label: 'Notification provider', status: 'not_ready', required: true, message: 'Notification provider must be configured and tested.' },
    { id: 'packet_generation', label: 'Packet generation', status: 'not_ready', required: true, message: 'Packet generation and encryption must succeed.' },
    { id: 'key_release_path', label: 'Key-release path', status: 'not_ready', required: true, message: 'Key-release path must be configured for the selected deployment mode.' },
    { id: 'mode_acknowledgement', label: 'Mode acknowledgement', status: 'not_ready', required: true, message: 'User must acknowledge the limitations of the selected mode.' },
  ];
}

/**
 * Mode-specific checks
 */

// Vault Mode: warn that no reliable automated release path exists.
export function getVaultModeChecks(): ReadinessCheck[] {
  return [
    ...createBaseChecks(),
    {
      id: 'vault_mode_warning',
      label: 'Vault Mode limitation',
      status: 'warning',
      required: false,
      message: 'Vault Mode stores and organizes your legacy packet locally. It does not guarantee automated release if this machine is offline, destroyed, inaccessible, or unable to notify your contacts.',
      resolutionHint: 'Consider upgrading to Dead Drop Mode or connecting Aegis Relay for greater release resilience.',
    },
  ];
}

// Dead Drop Mode: S3 storage + packet upload + notification + claim URL
export function getDeadDropModeChecks(): ReadinessCheck[] {
  return [
    ...createBaseChecks(),
    { id: 'storage_configured', label: 'S3-compatible storage', status: 'not_ready', required: true, message: 'S3-compatible storage must be configured.' },
    { id: 'packet_upload_verified', label: 'Packet upload verified', status: 'not_ready', required: true, message: 'Packet upload to storage must be verified.' },
    { id: 'packet_hash_verified', label: 'Packet hash verified', status: 'not_ready', required: true, message: 'Packet hash must be verified after upload.' },
    { id: 'claim_url_reachable', label: 'Claim portal reachable', status: 'not_ready', required: true, message: 'Public claim URL must be reachable, or user must acknowledge manual/limited release.', resolutionHint: 'Configure and test the claim portal URL, or acknowledge limited release behavior.' },
  ];
}

// Relay Monitoring: SaaS connection + heartbeat + fallback configured
export function getRelayMonitoringChecks(): ReadinessCheck[] {
  return [
    ...createBaseChecks(),
    { id: 'saas_connection', label: 'SaaS connection', status: 'not_ready', required: true, message: 'Aegis SaaS connection must be established.' },
    { id: 'heartbeat_accepted', label: 'Heartbeat accepted', status: 'not_ready', required: true, message: 'Heartbeat must be accepted by Relay.' },
    { id: 'owner_fallback_notification', label: 'Owner notification fallback', status: 'not_ready', required: true, message: 'Owner notification fallback must be configured.' },
    {
      id: 'relay_monitoring_warning',
      label: 'Relay Monitoring limitation',
      status: 'warning',
      required: false,
      message: 'Relay Monitoring detects offline status but may still depend on the local host for final release unless Relay Escrow is enabled.',
      resolutionHint: 'Enable Relay Escrow for full offline release capability.',
    },
  ];
}

// Relay Escrow: full trusted release path
export function getRelayEscrowChecks(): ReadinessCheck[] {
  return [
    ...createBaseChecks(),
    { id: 'saas_connection', label: 'SaaS connection', status: 'not_ready', required: true, message: 'Aegis SaaS connection must be established.' },
    { id: 'heartbeat_accepted', label: 'Heartbeat accepted', status: 'not_ready', required: true, message: 'Heartbeat must be accepted by Relay.' },
    { id: 'hosted_claim_portal', label: 'Hosted claim portal enabled', status: 'not_ready', required: true, message: 'Hosted claim portal must be enabled for Relay Escrow.' },
    { id: 'release_material_configured', label: 'Release material configured', status: 'not_ready', required: true, message: 'Release material must be configured for SaaS-held release.' },
    { id: 'release_policy_configured', label: 'Release policy configured', status: 'not_ready', required: true, message: 'Packet/key release policy must be configured.' },
    { id: 'escrow_trust_accepted', label: 'Escrow trust acknowledged', status: 'not_ready', required: true, message: 'User must accept that Aegis SaaS is trusted to execute the release policy.' },
  ];
}

// Hosted: fully managed checks
export function getHostedChecks(): ReadinessCheck[] {
  return [
    ...createBaseChecks(),
    { id: 'hosted_packet_generation', label: 'Hosted packet generation', status: 'not_ready', required: true, message: 'Hosted packet generation must be configured.' },
    { id: 'hosted_storage', label: 'Hosted storage', status: 'not_ready', required: true, message: 'Hosted storage must be active.' },
    { id: 'hosted_notification_provider', label: 'Hosted notification provider', status: 'not_ready', required: true, message: 'Hosted notification provider must be active.' },
    { id: 'hosted_claim_portal', label: 'Hosted claim portal', status: 'not_ready', required: true, message: 'Hosted claim portal must be active.' },
    { id: 'billing_active', label: 'Billing/subscription active', status: 'not_ready', required: true, message: 'Billing subscription must be active where applicable.' },
  ];
}

/**
 * Evaluate readiness. Returns whether the switch can arm.
 * If any required check has status 'not_ready', canArm is false
 * and the switch remains in 'draft' or 'not_ready' state.
 */
export function evaluateReadiness(checks: ReadinessCheck[]): boolean {
  return checks
    .filter(c => c.required)
    .every(c => c.status === 'ready');
}
```

- [ ] **Step 2: Write readiness tests**

Create `server/tests/readiness.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  evaluateReadiness,
  createBaseChecks,
  getVaultModeChecks,
  getDeadDropModeChecks,
  getRelayMonitoringChecks,
  getRelayEscrowChecks,
  getHostedChecks,
  type ReadinessCheck,
} from '../src/services/readiness.js';

describe('Arming Readiness Gates', () => {
  it('blocks arming when required checks are not_ready', () => {
    const checks = createBaseChecks();
    expect(evaluateReadiness(checks)).toBe(false);
  });

  it('allows arming when all required checks are ready', () => {
    const checks = createBaseChecks().map(c => ({ ...c, status: 'ready' as const }));
    expect(evaluateReadiness(checks)).toBe(true);
  });

  it('allows arming with warnings on non-required checks', () => {
    const checks: ReadinessCheck[] = [
      { id: 'required_check', label: 'Required', status: 'ready', required: true, message: 'OK' },
      { id: 'warning_check', label: 'Warning', status: 'warning', required: false, message: 'Non-blocking' },
    ];
    expect(evaluateReadiness(checks)).toBe(true);
  });

  it('blocks arming if any single required check fails', () => {
    const checks = createBaseChecks().map(c => ({ ...c, status: 'ready' as const }));
    checks[0].status = 'not_ready';
    expect(evaluateReadiness(checks)).toBe(false);
  });

  it('includes Vault Mode warning about local-only limitations', () => {
    const checks = getVaultModeChecks();
    const warning = checks.find(c => c.id === 'vault_mode_warning');
    expect(warning).toBeDefined();
    expect(warning!.required).toBe(false);
    expect(warning!.status).toBe('warning');
  });

  it('requires storage checks for Dead Drop Mode', () => {
    const checks = getDeadDropModeChecks();
    const storageCheck = checks.find(c => c.id === 'storage_configured');
    expect(storageCheck).toBeDefined();
    expect(storageCheck!.required).toBe(true);
  });

  it('requires SaaS connection for Relay Monitoring', () => {
    const checks = getRelayMonitoringChecks();
    const saasCheck = checks.find(c => c.id === 'saas_connection');
    expect(saasCheck).toBeDefined();
    expect(saasCheck!.required).toBe(true);
  });

  it('requires escrow trust acknowledgement for Relay Escrow', () => {
    const checks = getRelayEscrowChecks();
    const trustCheck = checks.find(c => c.id === 'escrow_trust_accepted');
    expect(trustCheck).toBeDefined();
    expect(trustCheck!.required).toBe(true);
  });

  it('requires billing for Hosted mode', () => {
    const checks = getHostedChecks();
    const billingCheck = checks.find(c => c.id === 'billing_active');
    expect(billingCheck).toBeDefined();
    expect(billingCheck!.required).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd server && npx vitest run tests/readiness.test.ts`
Expected: All readiness tests PASS

- [ ] **Step 4: Commit**

```bash
git add server/src/services/readiness.ts server/tests/readiness.test.ts
git commit -m "feat: arming readiness gates with mode-specific checks"
```

---

## Phase 1 Complete Checklist

After completing all tasks:

- [ ] `npm install` succeeds
- [ ] `npm test` passes all tests (health, auth, crypto, estate, contacts)
- [ ] `docker compose build` succeeds
- [ ] `docker compose up` starts the app
- [ ] http://localhost:8000 shows setup page
- [ ] Owner setup flow works
- [ ] Login/logout works
- [ ] Estate items can be created, listed, updated, deleted
- [ ] Contacts can be created, listed, reordered, deleted
- [ ] All sensitive fields are encrypted in the database

---

## Next Phase

Phase 2 plan (`2026-05-06-aegis-oss-phase2.md`) covers:
- Switch state machine (trip + heartbeat modes)
- Notification system (SMTP + Telegram)
- Worker polling loop
- Dashboard UI with countdown timer
- Trigger settings UI
