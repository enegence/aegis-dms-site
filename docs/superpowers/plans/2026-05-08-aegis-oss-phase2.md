# Aegis OSS — Phase 2: Core Domain Logic

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the core runtime behavior for the open-source Aegis Core app: switch state machine, switch CRUD/actions, readiness gates, owner check-ins, SMTP/Telegram notifications, reminder/warning dispatch, worker polling loop, dashboard summary, live countdown UI, and trigger/switch management UI — all with tests.

**Architecture:** Continue from Phase 1. The repo is a monorepo with `server/` (Fastify + Drizzle + SQLite), `web/` (React + Vite + Tailwind), `packages/shared/`, and `packages/contracts/`. Phase 2 should not implement encrypted packet assembly, S3 dead-drop sync, contact cascade, claim portal, or key release; those are Phase 3. However, Phase 2 must design state transitions so Phase 3 can attach packet/cascade/release behavior without rewriting the switch engine.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, better-sqlite3, React 18, Vite, Tailwind CSS, Vitest, Argon2, Node crypto, `packages/contracts`, Docker.

**Parent plan:** `2026-05-06-aegis-master-plan.md`

**Target repo:** `aegis/`

> **Note on phase labels:** Phase labels are sequencing guidance, not fixed delivery estimates. Optimize for correctness, security, and coherent architecture over calendar targets.

---

## Pre-requisites

Before starting, the engineer needs:

- Phase 1 completed and passing.
- Existing owner setup/login/session/CSRF flow working.
- Existing estate item CRUD with encrypted sensitive fields.
- Existing contact CRUD with encrypted sensitive fields and priority ordering.
- Existing `packages/contracts` with DeadDrop packet/release/heartbeat/claim/webhook/storage/notification schemas.
- Existing SQLite schema containing at least owner, sessions, estate items, contacts, switches, packets, contact claims, release runs, trust/local acknowledgements, audit events, and app/settings tables. If any required table is missing, add a migration in Task 1.
- All state-changing routes must require auth + CSRF unless explicitly public.

---

## Phase 2 Scope Boundary

### In Scope

- Switch domain types and validation.
- Switch state machine for `trip` and `heartbeat` modes.
- Switch CRUD API.
- Switch actions: arm, pause, cancel, check-in.
- Readiness checks and arming gates.
- Release-run constraint enforcement at trigger time.
- SMTP notification provider.
- Telegram notification provider.
- Notification test endpoints.
- Reminder and warning notification templates.
- Worker polling loop.
- Dashboard API.
- Dashboard UI with live countdown.
- Trigger/switch settings UI.
- Audit logging for switch, worker, and notification events.

### Explicitly Out of Scope Until Phase 3

- Packet builder.
- S3-compatible storage upload/verify/delete.
- Dead-drop packet sync.
- Contact cascade.
- Claim portal.
- Key view/download flows.
- Relay connection flow.
- Relay heartbeat client.
- TOTP UI polish.

---

## Task 1: Verify and Extend Phase 1 Schema for Core Logic

**Goal:** Ensure the database has all fields/tables needed for Phase 2 switch logic, worker idempotency, notification dispatch, readiness checks, and release-run constraint.

**Files:**

- Update: `server/src/db/schema.ts`
- Update/Create: `server/drizzle/*.sql`
- Update: `server/src/db/migrate.ts` if needed
- Test: `server/tests/schema-phase2.test.ts`

- [x] **Step 1: Review existing schema**

Confirm these tables exist:

```text
owner
sessions
estate_items
contacts
switches
packets
contact_claims
release_runs
audit_events
app_settings or settings/local_acknowledgements
```

If `release_runs` does not exist, add it before any switch-engine work.

- [x] **Step 2: Add/confirm switch fields**

The `switches` table should support:

```typescript
mode: 'trip' | 'heartbeat'
deploymentMode: 'vault' | 'dead_drop' | 'relay_monitoring' | 'relay_escrow' | 'hosted'
status: 'draft' | 'armed' | 'warning' | 'triggered' | 'cascade_active' | 'completed' | 'cancelled' | 'paused' | 'failed'
triggerAt
heartbeatIntervalDays
nextCheckInDueAt
warningStartsAt
gracePeriodHours
warningWindowDays
lastCheckInAt
lastReminderSentAt
lastWarningSentAt
lastEvaluatedAt
selectedContactIds
selectedEstateItemIds
```

If `lastReminderSentAt`, `lastWarningSentAt`, or `lastEvaluatedAt` are missing, add them.

- [x] **Step 3: Add notification events table**

Create a lightweight operational delivery log. This is not the same as the audit log; it can support retry/idempotency without exposing PII.

```typescript
export const notificationEvents = sqliteTable('notification_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  switchId: integer('switch_id').references(() => switches.id),
  contactId: integer('contact_id').references(() => contacts.id),
  channel: text('channel').notNull(), // email | telegram | sms_future
  purpose: text('purpose').notNull(), // test | reminder | warning | triggered
  status: text('status').notNull(), // queued | sent | failed | skipped
  externalId: text('external_id'),
  failureReason: text('failure_reason'), // sanitized, no PII
  sentAt: integer('sent_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
```

- [x] **Step 4: Add/confirm app settings table**

If not already present, add an `app_settings` table for non-secret configuration flags and encrypted provider secrets:

```typescript
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  encrypted: integer('encrypted', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
```

Store provider secrets encrypted using the existing field encryption service.

- [x] **Step 5: Write schema tests**

Create `server/tests/schema-phase2.test.ts`:

- verifies migrations run against a blank DB;
- verifies `switches` has required fields;
- verifies `release_runs` exists;
- verifies `notification_events` exists;
- verifies `app_settings` exists or equivalent settings mechanism exists.

- [x] **Step 6: Run tests**

```bash
cd server
npm test
```

- [x] **Step 7: Commit**

```bash
git add server/src/db server/drizzle server/tests/schema-phase2.test.ts
git commit -m "feat: extend schema for switch engine and notifications"
```

---

## Task 2: Update Shared Types and Validation Schemas

**Goal:** Define canonical Phase 2 API/domain types for switches, readiness checks, dashboard summary, notification configuration, and switch actions.

**Files:**

- Update: `packages/shared/src/types.ts`
- Create: `server/src/schemas/switches.ts`
- Create: `server/src/schemas/notifications.ts`
- Create: `server/src/schemas/readiness.ts`
- Test: `server/tests/schemas-phase2.test.ts`

- [x] **Step 1: Add/confirm shared switch and readiness types**

Update shared types with:

```typescript
export type SwitchMode = 'trip' | 'heartbeat';
export type DeploymentMode = 'vault' | 'dead_drop' | 'relay_monitoring' | 'relay_escrow' | 'hosted';
export type ReadinessStatus = 'ready' | 'not_ready' | 'warning';

export interface ReadinessCheck {
  id: string;
  label: string;
  status: ReadinessStatus;
  required: boolean;
  message: string;
  resolutionHint?: string;
}

export interface SwitchReadiness {
  switchId?: number;
  status: ReadinessStatus;
  checks: ReadinessCheck[];
}
```

- [x] **Step 2: Add dashboard types**

```typescript
export interface DashboardSummary {
  ownerName: string;
  activeSwitchCount: number;
  warningSwitchCount: number;
  triggeredSwitchCount: number;
  nextSwitch: Switch | null;
  nextActionAt: string | null;
  notificationsConfigured: boolean;
  relayConfigured: boolean;
  storageConfigured: boolean;
  health: HealthStatus;
}
```

- [x] **Step 3: Create zod schemas for switch routes**

Create `server/src/schemas/switches.ts` with schemas for:

```text
CreateSwitchInput
UpdateSwitchInput
ArmSwitchInput
PauseSwitchInput
CancelSwitchInput
CheckInInput
SwitchParams
```

Rules:

- `trip` mode requires `triggerAt`.
- `heartbeat` mode requires `heartbeatIntervalDays`.
- `gracePeriodHours` must be >= 1.
- `warningWindowDays` must be >= 0.
- `selectedContactIds` and `selectedEstateItemIds` must be arrays of existing IDs at service layer.
- Deployment mode defaults to `vault`.

- [x] **Step 4: Create notification config schemas**

Create `server/src/schemas/notifications.ts` for:

```text
SMTP settings
Telegram settings
Test notification request
Notification channel preference
```

Do not expose SMTP password or Telegram bot token in API responses.

- [x] **Step 5: Write schema tests**

Test valid/invalid switch inputs, invalid mode combinations, notification config validation, and readiness output shape.

- [x] **Step 6: Commit**

```bash
git add packages/shared/src/types.ts server/src/schemas server/tests/schemas-phase2.test.ts
git commit -m "feat: add phase two domain schemas"
```

---

## Task 3: Implement Audit Logging Service

**Goal:** Provide a reusable audit service for switch, readiness, worker, notification, and check-in events. Audit metadata must never contain plaintext PII.

**Files:**

- Create: `server/src/services/audit.ts`
- Test: `server/tests/audit.test.ts`

- [x] **Step 1: Create audit service**

Implement:

```typescript
export interface AuditInput {
  switchId?: number | null;
  eventType: string;
  actorType: 'owner' | 'system' | 'contact' | 'relay';
  actorId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function writeAuditEvent(input: AuditInput): Promise<void>;
```

- [x] **Step 2: Add metadata sanitizer**

Reject or redact keys that look like PII/secrets:

```text
email
phone
name
institution
account
password
secret
token
apiKey
keyMaterial
plaintext
executorNotes
```

- [x] **Step 3: Add tests**

Test:

- valid audit event writes;
- PII-like keys are rejected or redacted;
- audit events can be queried ordered by newest first;
- no event writes fail the main business transaction unexpectedly unless configured strict.

- [x] **Step 4: Commit**

```bash
git add server/src/services/audit.ts server/tests/audit.test.ts
git commit -m "feat: add redacted audit logging service"
```

---

## Task 4: Implement Switch Repository

**Goal:** Centralize all switch DB reads/writes before adding state-machine behavior and routes.

**Files:**

- Create: `server/src/services/switch-repository.ts`
- Test: `server/tests/switch-repository.test.ts`

- [x] **Step 1: Implement repository methods**

Methods:

```typescript
listSwitches(): Promise<SwitchRecord[]>;
getSwitchById(id: number): Promise<SwitchRecord | null>;
createSwitch(input: CreateSwitchData): Promise<SwitchRecord>;
updateSwitch(id: number, input: UpdateSwitchData): Promise<SwitchRecord>;
deleteSwitch(id: number): Promise<void>;
getActiveReleaseRun(): Promise<ReleaseRunRecord | null>;
createReleaseRun(input: CreateReleaseRunInput): Promise<ReleaseRunRecord>;
markSwitchStatus(id: number, status: SwitchStatus, patch?: Partial<SwitchRecord>): Promise<SwitchRecord>;
```

- [ ] **Step 2: Normalize JSON columns**

`selectedContactIds` and `selectedEstateItemIds` are stored as JSON text. Repository should expose arrays, not raw strings.

- [x] **Step 3: Add tests**

Test create/list/get/update/delete and JSON normalization.

- [x] **Step 4: Commit**

```bash
git add server/src/services/switch-repository.ts server/tests/switch-repository.test.ts
git commit -m "feat: add switch repository"
```

---

## Task 5: Implement Switch State Machine

**Goal:** Implement deterministic state transitions for `trip` and `heartbeat` switches.

**Files:**

- Create: `server/src/services/switch-engine.ts`
- Test: `server/tests/switch-engine.test.ts`

- [x] **Step 1: Define state transition helpers**

Implement pure functions first:

```typescript
calculateInitialSchedule(input, now): ScheduleResult;
calculateWarningStartsAt(switchRecord): Date | null;
calculateNextCheckInDueAt(lastCheckInAt, intervalDays): Date;
evaluateSwitch(switchRecord, now): SwitchEvaluation;
```

- [ ] **Step 2: Support trip mode**

Trip mode behavior:

```text
Draft -> Armed when readiness passes and owner arms.
Armed -> Warning when now >= warningStartsAt.
Armed -> Triggered when now >= triggerAt and no warning window applies.
Warning -> Triggered when now >= triggerAt.
Paused switches do not transition.
Cancelled switches do not transition.
Triggered switches do not transition further in Phase 2.
```

- [x] **Step 2: Support trip mode**
<!-- already checked step 1 above -->
- [x] **Step 3: Support heartbeat mode**

Heartbeat mode behavior:

```text
Draft -> Armed when readiness passes and owner arms.
Armed -> Warning when now >= nextCheckInDueAt.
Warning -> Triggered when now >= nextCheckInDueAt + gracePeriodHours.
Check-in from Armed or Warning resets lastCheckInAt and nextCheckInDueAt.
Paused switches do not transition.
Cancelled switches do not transition.
```

- [x] **Step 4: Enforce release-run constraint**

When a switch evaluates to `triggered`:

```text
If no active release run exists:
  create release run with status active_pending_packet.

If an active release run exists:
  do not create another release run.
  mark/record the switch trigger as suppressed_by_active_release_run.
  write audit event.
```

Phase 3 can change `active_pending_packet` to cascade states after packet creation.

- [x] **Step 5: Add audit hooks at service layer**

Audit events:

```text
switch_armed
switch_paused
switch_cancelled
check_in_completed
warning_started
trigger_reached
release_run_created
trigger_suppressed_by_active_release_run
```

No PII in metadata.

- [x] **Step 6: Add tests**

Test:

- trip mode armed -> warning -> triggered;
- trip mode no warning window -> triggered;
- heartbeat check-in resets due date;
- heartbeat missed check-in -> warning;
- heartbeat grace period -> triggered;
- paused switch does not transition;
- cancelled switch does not transition;
- second triggered switch does not create parallel release run;
- audit events are written.

- [x] **Step 7: Commit**

```bash
git add server/src/services/switch-engine.ts server/tests/switch-engine.test.ts
git commit -m "feat: implement switch state machine"
```

---

## Task 6: Implement Readiness Service and Arming Gates

**Goal:** Prevent users from arming switches that cannot perform the configured behavior.

**Files:**

- Create: `server/src/services/readiness.ts`
- Test: `server/tests/readiness.test.ts`

- [x] **Step 1: Implement readiness checks**

Checks:

```text
owner_setup_complete
at_least_one_contact_selected
selected_contacts_exist
at_least_one_estate_item_selected
selected_estate_items_exist
switch_schedule_valid
notification_provider_configured
notification_provider_tested
packet_generation_placeholder
storage_configured_for_dead_drop
claim_portal_reachable_or_acknowledged
key_release_path_configured
mode_limitations_acknowledged
```

- [ ] **Step 2: Mode-specific Phase 2 behavior**

Because Phase 3 implements packets/storage/cascade, Phase 2 readiness should be honest:

```text
Vault Mode:
  Can be armed for local reminders/check-in behavior if user acknowledges limitations.

Dead Drop:
  Not fully ready until Phase 3 packet/storage sync exists. Return not_ready for automated release, but allow draft configuration.

Relay Monitoring:
  Not fully ready until Relay client/linking exists. Return not_ready unless manually configured test heartbeat exists later.

Relay Escrow:
  Not ready in OSS until SaaS Relay Escrow + packet/release material exists.

Hosted:
  Not valid inside OSS except as a display/delegation mode.
```

- [x] **Step 2: Mode-specific Phase 2 behavior** <!-- implemented above -->
- [x] **Step 3: Add arming gate**

`armSwitch(id)` must call readiness service. If required readiness fails, return 400 with structured checks.

- [x] **Step 4: Add acknowledgement support**

If `local_acknowledgements` exists, readiness should check required mode acknowledgements. If not, add a minimal table/migration.

- [x] **Step 5: Add tests**

Test:

- no contacts -> not ready;
- no estate items -> not ready;
- invalid schedule -> not ready;
- Vault Mode without acknowledgement -> warning/not_ready as configured;
- Dead Drop missing storage -> not ready;
- readiness response includes clear resolution hints;
- arm route cannot bypass readiness.

- [x] **Step 6: Commit**

```bash
git add server/src/services/readiness.ts server/tests/readiness.test.ts
git commit -m "feat: add switch readiness gates"
```

---

## Task 7: Implement Switch API Routes

**Goal:** Expose authenticated, CSRF-protected switch CRUD and action endpoints.

**Files:**

- Create/Update: `server/src/routes/switches.ts`
- Update: `server/src/index.ts`
- Test: `server/tests/switches.test.ts`

- [x] **Step 1: Register route plugin**

Ensure `switchRoutes` is registered under `/api/switches` after auth/CSRF middleware.

- [ ] **Step 2: Implement CRUD endpoints**

Routes:

```text
GET    /api/switches
GET    /api/switches/:id
POST   /api/switches
PUT    /api/switches/:id
DELETE /api/switches/:id
```

Rules:

- Auth required.
- CSRF required for POST/PUT/DELETE.
- Cannot delete a switch in `triggered` or `cascade_active`; cancel instead.
- Cannot directly set privileged statuses via generic update.

- [x] **Step 2: Implement CRUD endpoints** <!-- done above -->
- [x] **Step 3: Implement action endpoints**

Routes:

```text
GET  /api/switches/:id/readiness
POST /api/switches/:id/arm
POST /api/switches/:id/pause
POST /api/switches/:id/cancel
POST /api/switches/:id/check-in
POST /api/switches/:id/evaluate
```

Notes:

- `evaluate` can be owner-only/manual test route for development; worker uses service directly.
- `check-in` requires owner auth, not just possession of a link.

- [x] **Step 4: Add route tests**

Test:

- unauthenticated access rejected;
- missing CSRF rejected;
- CRUD happy path;
- arm fails when readiness fails;
- arm succeeds when readiness passes;
- pause/cancel/check-in transitions;
- invalid mode data rejected;
- audit events written.

- [x] **Step 5: Commit**

```bash
git add server/src/routes/switches.ts server/src/index.ts server/tests/switches.test.ts
git commit -m "feat: add switch management api"
```

---

## Task 8: Implement Notification Providers

**Goal:** Implement local notification dispatch using owner-configured SMTP and Telegram.

**Files:**

- Create: `server/src/services/notifications.ts`
- Create: `server/src/services/notification-templates.ts`
- Create: `server/src/services/providers/smtp.ts`
- Create: `server/src/services/providers/telegram.ts`
- Update: `server/package.json`
- Test: `server/tests/notifications.test.ts`

- [x] **Step 1: Add dependencies**

Use `nodemailer` for SMTP:

```bash
cd server
npm install nodemailer
npm install -D @types/nodemailer
```

Telegram can use global `fetch` in Node 20+.

- [x] **Step 2: Implement provider interface**

Match `packages/contracts` notification provider concepts:

```typescript
interface NotificationProvider {
  channel: 'email' | 'telegram';
  send(request: NotificationRequest): Promise<NotificationResult>;
  testConnection(): Promise<{ ok: boolean; message?: string }>;
}
```

- [x] **Step 3: Implement SMTP provider**

Rules:

- Use owner-configured SMTP settings.
- Never log SMTP password.
- Use sanitized error messages.
- Support test email.
- Store delivery result in `notification_events`.

- [x] **Step 4: Implement Telegram provider**

Rules:

- Use owner-configured bot token and chat ID.
- Never log bot token.
- Support test message.
- Store delivery result in `notification_events`.

- [x] **Step 5: Implement notification templates**

Templates:

```text
owner_test_notification
owner_trip_reminder
owner_heartbeat_reminder
owner_warning_started
owner_trigger_reached_local_only
```

Do not include sensitive estate/contact details in notifications.

- [x] **Step 6: Add tests**

Mock SMTP and Telegram network calls. Test:

- template rendering contains no PII;
- provider config missing -> clear failure;
- successful send writes notification event;
- failed send writes sanitized failure;
- test connection works with mocked transport.

- [x] **Step 7: Commit**

```bash
git add server/package.json package-lock.json server/src/services/notifications.ts server/src/services/notification-templates.ts server/src/services/providers server/tests/notifications.test.ts
git commit -m "feat: add smtp and telegram notification providers"
```

---

## Task 9: Implement Settings API for Notifications

**Goal:** Let owner save and test SMTP/Telegram settings from the UI without exposing secrets.

**Files:**

- Create/Update: `server/src/routes/settings.ts`
- Update: `server/src/index.ts`
- Test: `server/tests/settings.test.ts`

- [x] **Step 1: Implement notification settings routes**

Routes:

```text
GET  /api/settings/notifications
PUT  /api/settings/notifications/smtp
PUT  /api/settings/notifications/telegram
POST /api/settings/notifications/test
```

- [x] **Step 2: Store secrets encrypted**

Encrypt:

```text
SMTP password
Telegram bot token
```

Do not return secrets in GET responses. Return booleans like `hasPassword` / `hasBotToken`.

- [x] **Step 3: Add route tests**

Test:

- auth required;
- CSRF required;
- secrets encrypted at rest;
- GET response redacts secrets;
- test endpoint invokes provider;
- audit events written for settings change and test.

- [x] **Step 4: Commit**

```bash
git add server/src/routes/settings.ts server/src/index.ts server/tests/settings.test.ts
git commit -m "feat: add notification settings api"
```

---

## Task 10: Implement Reminder and Warning Scheduler

**Goal:** Determine when owner reminders/warnings should be sent, without duplicate sends.

**Files:**

- Create: `server/src/services/reminders.ts`
- Test: `server/tests/reminders.test.ts`

- [x] **Step 1: Define reminder policy**

Trip mode:

```text
Send reminder when warningStartsAt is reached.
Send warning when switch enters warning.
Send triggered notice when switch enters triggered.
```

Heartbeat mode:

```text
Send reminder before nextCheckInDueAt if configured.
Send warning when nextCheckInDueAt is missed.
Send triggered notice after grace period expires.
```

Phase 2 can use a simple default reminder policy and expose fine-grained scheduling later.

- [ ] **Step 2: Prevent duplicate sends**

Use:

```text
lastReminderSentAt
lastWarningSentAt
notification_events purpose/status
```

to avoid repeated notifications every worker tick.

- [x] **Step 2: Prevent duplicate sends** <!-- done above -->
- [x] **Step 3: Add tests**

Test:

- reminder due once;
- warning due once;
- no duplicate reminders;
- missed notification can retry after failure if policy allows;
- messages do not contain PII.

- [x] **Step 4: Commit**

```bash
git add server/src/services/reminders.ts server/tests/reminders.test.ts
git commit -m "feat: add reminder and warning scheduler"
```

---

## Task 11: Implement Worker Polling Loop

**Goal:** Run a simple local worker that periodically evaluates armed/warning switches, sends reminders/warnings, and records audit events.

**Files:**

- Create: `server/src/worker/index.ts`
- Update: `server/src/index.ts`
- Test: `server/tests/worker.test.ts`

- [x] **Step 1: Implement worker service**

```typescript
export interface WorkerOptions {
  intervalMs: number;
  runImmediately?: boolean;
}

export function startWorker(options?: WorkerOptions): { stop(): Promise<void> };
export async function runWorkerOnce(now?: Date): Promise<WorkerRunResult>;
```

- [ ] **Step 2: Worker behavior**

Each tick:

```text
1. Load armed/warning switches.
2. Evaluate state transitions.
3. Write audit events for transitions.
4. Send due reminders/warnings.
5. Update lastEvaluatedAt.
6. Never start contact cascade in Phase 2.
```

- [x] **Step 2: Worker behavior** <!-- done above -->
- [x] **Step 3: Startup control**

Do not run worker in tests unless explicitly enabled.

Use env:

```text
AEGIS_WORKER_ENABLED=true
AEGIS_WORKER_INTERVAL_SECONDS=60
```

- [x] **Step 4: Add tests**

Test `runWorkerOnce()` with fake dates and mocked notifications.

- [x] **Step 5: Commit**

```bash
git add server/src/worker/index.ts server/src/index.ts server/tests/worker.test.ts
git commit -m "feat: add switch evaluation worker"
```

---

## Task 12: Implement Dashboard API

**Goal:** Provide a single dashboard summary endpoint for the web app.

**Files:**

- Create: `server/src/routes/dashboard.ts`
- Update: `server/src/index.ts`
- Test: `server/tests/dashboard.test.ts`

- [x] **Step 1: Implement dashboard route**

Route:

```text
GET /api/dashboard
```

Response:

```typescript
interface DashboardSummary {
  ownerName: string;
  activeSwitchCount: number;
  warningSwitchCount: number;
  triggeredSwitchCount: number;
  nextSwitch: Switch | null;
  nextActionAt: string | null;
  notificationsConfigured: boolean;
  relayConfigured: boolean;
  storageConfigured: boolean;
  health: HealthStatus;
}
```

- [ ] **Step 2: Include provider status**

Return coarse status only:

```text
configured | not_configured | error
```

Do not return secrets or private provider details.

- [x] **Step 2: Include provider status** <!-- done above -->
- [x] **Step 3: Add tests**

Test empty dashboard, dashboard with active switch, dashboard with warning switch, provider status redaction.

- [x] **Step 4: Commit**

```bash
git add server/src/routes/dashboard.ts server/src/index.ts server/tests/dashboard.test.ts
git commit -m "feat: add dashboard summary api"
```

---

## Task 13: Implement Frontend API Client Updates

**Goal:** Add typed client helpers for Phase 2 endpoints while preserving CSRF behavior.

**Files:**

- Update: `web/src/lib/api.ts`
- Create: `web/src/lib/switches.ts`
- Create: `web/src/lib/dashboard.ts`
- Create: `web/src/lib/settings.ts`
- Test: optional `web/src/lib/*.test.ts` if frontend test setup exists

- [x] **Step 1: Add switch API helpers**

Helpers:

```typescript
listSwitches()
getSwitch(id)
createSwitch(input)
updateSwitch(id, input)
deleteSwitch(id)
getSwitchReadiness(id)
armSwitch(id)
pauseSwitch(id)
cancelSwitch(id)
checkInSwitch(id)
```

- [x] **Step 2: Add dashboard/settings helpers**

```typescript
getDashboard()
getNotificationSettings()
saveSmtpSettings(input)
saveTelegramSettings(input)
testNotification(input)
```

- [x] **Step 3: Preserve CSRF**

All state-changing helpers must use the existing CSRF-enabled fetch wrapper.

- [x] **Step 4: Commit**

```bash
git add web/src/lib
git commit -m "feat: add phase two api client helpers"
```

---

## Task 14: Implement Switch Management UI

**Goal:** Let owner create, edit, arm, pause, cancel, and check in switches.

**Files:**

- Create/Update: `web/src/pages/Trigger.tsx`
- Create: `web/src/pages/Switches.tsx` if preferred
- Create: `web/src/components/switches/SwitchForm.tsx`
- Create: `web/src/components/switches/SwitchCard.tsx`
- Create: `web/src/components/switches/ReadinessChecklist.tsx`
- Create: `web/src/components/switches/SwitchActionButtons.tsx`
- Update: `web/src/App.tsx`

- [ ] **Step 1: Build switch list UI**

Show:

```text
name
mode
deployment mode
status
next action date
last check-in
selected contacts count
selected estate items count
```

- [ ] **Step 2: Build switch form**

Fields:

```text
name
mode
trip trigger date/time
heartbeat interval days
warning window days
grace period hours
deployment mode
selected contacts
selected estate items
```

- [ ] **Step 3: Build readiness checklist**

Display readiness checks from API with:

```text
ready
warning
not_ready
resolution hint
```

- [ ] **Step 4: Build action buttons**

Actions:

```text
Arm
Pause
Cancel
Check in now
Evaluate now (dev/test optional)
```

Disable actions that are invalid for current status.

- [ ] **Step 5: UX copy for deployment modes**

Use honest language:

```text
Vault Mode stores and organizes your legacy information locally. It does not guarantee automated release if this machine is offline, destroyed, inaccessible, or unable to notify your contacts.
```

- [ ] **Step 6: Commit**

```bash
git add web/src/pages web/src/components/switches web/src/App.tsx
git commit -m "feat: add switch management ui"
```

---

## Task 15: Implement Dashboard Page With Live Countdown

**Goal:** Replace placeholder dashboard with operational status and live countdown.

**Files:**

- Update: `web/src/pages/Dashboard.tsx`
- Create: `web/src/components/dashboard/CountdownCard.tsx`
- Create: `web/src/components/dashboard/SystemHealthCard.tsx`
- Create: `web/src/components/dashboard/SwitchSummaryCards.tsx`

- [ ] **Step 1: Fetch dashboard summary**

Use `GET /api/dashboard`.

- [ ] **Step 2: Add live countdown**

If `nextActionAt` exists, show a client-side countdown that updates every second.

- [ ] **Step 3: Show system status**

Show:

```text
Database
Notifications
Storage
Relay
```

Keep statuses high-level; do not leak config/secrets.

- [ ] **Step 4: Add empty state**

If no switches exist, prompt user to create a switch.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/Dashboard.tsx web/src/components/dashboard
git commit -m "feat: add operational dashboard with countdown"
```

---

## Task 16: Implement Notification Settings UI

**Goal:** Let owner configure and test SMTP/Telegram from the app.

**Files:**

- Create/Update: `web/src/pages/Settings.tsx`
- Create: `web/src/components/settings/SmtpSettingsForm.tsx`
- Create: `web/src/components/settings/TelegramSettingsForm.tsx`
- Create: `web/src/components/settings/TestNotificationPanel.tsx`

- [ ] **Step 1: Build SMTP settings form**

Fields:

```text
host
port
user
password
from email
secure/tls setting if supported
```

Do not display existing password.

- [ ] **Step 2: Build Telegram settings form**

Fields:

```text
bot token
chat ID
```

Do not display existing bot token.

- [ ] **Step 3: Build test notification panel**

Allow user to send a test message by email or Telegram.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/Settings.tsx web/src/components/settings
git commit -m "feat: add notification settings ui"
```

---

## Task 17: Documentation Updates

**Goal:** Document Phase 2 runtime behavior and limitations.

**Files:**

- Create/Update: `docs/switches.md`
- Create/Update: `docs/notifications.md`
- Create/Update: `docs/release-modes.md`
- Update: `README.md`

- [ ] **Step 1: Document switch modes**

Explain trip vs heartbeat.

- [ ] **Step 2: Document deployment modes**

Explain Vault/Dead Drop/Relay Monitoring/Relay Escrow/Hosted and current implementation status.

- [ ] **Step 3: Document notification setup**

Explain SMTP and Telegram configuration.

- [ ] **Step 4: Document Phase 2 limitations**

State clearly:

```text
Phase 2 supports reminders, warnings, and switch state transitions. Packet generation, S3 dead-drop sync, contact cascade, claim portal, and release-key workflows arrive in Phase 3.
```

- [ ] **Step 5: Commit**

```bash
git add docs README.md
git commit -m "docs: document switch and notification behavior"
```

---

## Task 18: End-to-End Phase 2 Verification

**Goal:** Verify the full Phase 2 experience works locally.

- [ ] **Step 1: Run all server tests**

```bash
cd server
npm test
```

- [ ] **Step 2: Build frontend**

```bash
cd web
npm run build
```

- [ ] **Step 3: Build Docker image**

```bash
docker compose build
```

- [ ] **Step 4: Manual smoke test**

Test:

```text
1. Start app.
2. Login as owner.
3. Create estate item.
4. Create contact.
5. Configure SMTP or Telegram test provider.
6. Create heartbeat switch.
7. View readiness.
8. Arm switch.
9. Check in.
10. Confirm dashboard countdown updates.
11. Manually run worker/evaluate.
12. Confirm warning/trigger transitions with fake dates or shortened intervals.
13. Confirm audit logs contain no PII.
```

- [ ] **Step 5: Final commit**

```bash
git status
git commit -m "test: complete phase two oss verification" --allow-empty
```

---

## Phase 2 Acceptance Criteria

Phase 2 is complete when:

```text
- Switch CRUD works end-to-end.
- Trip and heartbeat state-machine tests pass.
- Arming gates prevent non-viable switches.
- Owner check-in works and resets heartbeat schedule.
- SMTP provider can send/test notifications.
- Telegram provider can send/test notifications.
- Worker evaluates switches and sends reminders/warnings without duplicates.
- Dashboard shows active/warning/triggered state and live countdown.
- Trigger/switch UI supports create/edit/arm/pause/cancel/check-in.
- Audit logs contain no plaintext PII or secrets.
- All tests pass.
- Docker build still works.
```

---

## Notes for Phase 3 Handoff

Phase 3 should start from these handoff points:

```text
switch-engine.ts transitions to triggered but does not cascade yet.
release_runs exists and can represent active_pending_packet.
notification service can send owner/contact-safe messages.
worker can evaluate switches reliably.
readiness service has placeholders for packet/storage/claim/key-release checks.
contracts package exists for packet/release/heartbeat/claim/webhook/provider shapes.
```
