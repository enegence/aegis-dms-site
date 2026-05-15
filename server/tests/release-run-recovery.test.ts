/**
 * Release-run recovery and idempotency tests (SaaS).
 *
 * Tests:
 *  - active release run survives worker restart (state not reset)
 *  - second switch trigger is suppressed while release run active (audit event emitted)
 *  - completed release run cannot transition to any state
 *  - cancelled release run cannot transition to any state
 *  - failed release run CAN be manually retried (failed → active)
 *  - illegal transition returns typed error (ReleaseRunTransitionError)
 *  - idempotent transition to current state is a no-op
 *  - transition audit event contains no PII
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('../src/services/storage/index.js', () => ({
  uploadManagedPacket: vi.fn().mockResolvedValue({
    storageObjectKey: 'packets/u/rr/p-v1.aegis.enc',
    storageProvider: 's3',
    storageBucket: 'test-bucket',
    storageRegion: 'auto',
    storageVersionId: null,
    lastVerifiedAt: new Date(),
  }),
  verifyManagedPacket: vi.fn(),
  downloadManagedPacket: vi.fn(),
  deleteManagedPacket: vi.fn(),
  buildObjectKey: vi.fn(),
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/index.js';
import { releaseRuns, switches, auditEvents } from '../src/db/schema.js';
import { encryptContact } from '../src/services/contact-mapper.js';
import { encryptEstateItem } from '../src/services/estate-mapper.js';
import { estateItems, contacts } from '../src/db/schema.js';
import { startOrAttachHostedReleaseRun } from '../src/services/hosted-release-run.js';
import {
  getReleaseRunById,
  updateReleaseRun,
} from '../src/repositories/release-run-repository.js';
import {
  transitionReleaseRun,
  ReleaseRunTransitionError,
  isTerminalReleaseRunStatus,
} from '../src/services/release-run-transitions.js';
import { recoverActiveReleaseRuns } from '../src/worker/index.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
async function seedUserWithSwitch(app: Awaited<ReturnType<typeof buildApp>>) {
  const email = `rr-recovery-${randomUUID()}@example.com`;
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      displayName: 'Recovery Test',
      email,
      password: 'testpass12345',
      timezone: 'UTC',
    },
  });
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: 'testpass12345' },
  });
  const meRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: String(loginRes.headers['set-cookie']) },
  });
  const userId = JSON.parse(meRes.payload).id as string;
  const fieldKey = app.config.fieldEncryptionKey;

  const [ei] = await app.db
    .insert(estateItems)
    .values({
      userId,
      ...encryptEstateItem({ category: 'financial', title: 'Test Account', institutionName: 'Bank' }, fieldKey),
    })
    .returning();

  const [ct] = await app.db
    .insert(contacts)
    .values({
      userId,
      priorityOrder: 1,
      confirmationWindowHours: 48,
      ...encryptContact({ fullName: 'Jane Doe', email: 'jane@example.com' }, fieldKey),
    })
    .returning();

  const [sw] = await app.db
    .insert(switches)
    .values({
      userId,
      name: 'Test Switch',
      mode: 'trip',
      triggerAt: new Date(Date.now() + 86400000 * 30),
      gracePeriodHours: 72,
      warningWindowDays: 7,
      selectedEstateItemIds: [ei.id],
      selectedContactIds: [ct.id],
    })
    .returning();

  return { userId, switchId: sw.id };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('SaaS release run recovery', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('active release run survives worker restart — state is not reset', async () => {
    const { userId, switchId } = await seedUserWithSwitch(app);

    const result = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });

    const before = await getReleaseRunById(app.db, result.releaseRunId);
    expect(before?.status).toBe('active');

    // Simulate worker restart
    const recovered = await recoverActiveReleaseRuns(app.db);
    expect(recovered).toBeGreaterThanOrEqual(1);

    // State should be unchanged
    const after = await getReleaseRunById(app.db, result.releaseRunId);
    expect(after?.status).toBe('active');
  });

  it('second switch trigger is suppressed while release run active', async () => {
    const { userId, switchId: switchId1 } = await seedUserWithSwitch(app);

    // Add second switch for same user
    const [sw2] = await app.db
      .insert(switches)
      .values({
        userId,
        name: 'Second Switch',
        mode: 'trip',
        triggerAt: new Date(Date.now() + 86400000 * 30),
        gracePeriodHours: 72,
        warningWindowDays: 7,
        selectedEstateItemIds: [],
        selectedContactIds: [],
      })
      .returning();

    // First trigger
    await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId1,
      reason: 'trip_triggered',
    });

    // Second trigger while run active → should be suppressed
    const second = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: sw2.id,
      reason: 'trip_triggered',
    });

    expect(second.isNew).toBe(false);
    expect(second.suppressedSwitchIds).toContain(sw2.id);

    // Only one active run should exist
    const allRuns = await app.db
      .select()
      .from(releaseRuns)
      .where(eq(releaseRuns.userId, userId));
    expect(allRuns.filter((r) => r.status === 'active' || r.status === 'cascade_active').length).toBe(1);
  });

  it('completed release run cannot transition to any state', async () => {
    const { userId, switchId } = await seedUserWithSwitch(app);

    const result = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });

    await updateReleaseRun(app.db, result.releaseRunId, {
      status: 'completed',
      completedAt: new Date(),
    });

    await expect(
      transitionReleaseRun(app.db, result.releaseRunId, 'completed', 'active'),
    ).rejects.toThrowError(ReleaseRunTransitionError);

    await expect(
      transitionReleaseRun(app.db, result.releaseRunId, 'completed', 'failed'),
    ).rejects.toThrowError(ReleaseRunTransitionError);
  });

  it('cancelled release run cannot transition to any state', async () => {
    const { userId, switchId } = await seedUserWithSwitch(app);

    const result = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });

    await updateReleaseRun(app.db, result.releaseRunId, {
      status: 'cancelled',
      cancelledAt: new Date(),
    });

    await expect(
      transitionReleaseRun(app.db, result.releaseRunId, 'cancelled', 'active'),
    ).rejects.toThrowError(ReleaseRunTransitionError);
  });

  it('failed release run CAN be manually retried (failed → active)', async () => {
    const { userId, switchId } = await seedUserWithSwitch(app);

    const result = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });

    await updateReleaseRun(app.db, result.releaseRunId, { status: 'failed' });

    const failed = await getReleaseRunById(app.db, result.releaseRunId);
    expect(failed?.status).toBe('failed');

    // Manual retry
    const retried = await transitionReleaseRun(app.db, result.releaseRunId, 'failed', 'active');
    expect(retried.status).toBe('active');
  });

  it('illegal transition returns ReleaseRunTransitionError', async () => {
    const { userId, switchId } = await seedUserWithSwitch(app);

    const result = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });

    // active → pending is not an allowed transition
    await expect(
      transitionReleaseRun(app.db, result.releaseRunId, 'active', 'pending'),
    ).rejects.toThrowError(ReleaseRunTransitionError);
  });

  it('idempotent transition to current state is a no-op (no error)', async () => {
    const { userId, switchId } = await seedUserWithSwitch(app);

    const result = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });

    const run = await getReleaseRunById(app.db, result.releaseRunId);
    expect(run?.status).toBe('active');

    // active → active should be idempotent
    const same = await transitionReleaseRun(app.db, result.releaseRunId, 'active', 'active');
    expect(same.status).toBe('active');
    expect(same.id).toBe(result.releaseRunId);
  });

  it('valid transition active → paused and back to active', async () => {
    const { userId, switchId } = await seedUserWithSwitch(app);

    const result = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });

    const paused = await transitionReleaseRun(app.db, result.releaseRunId, 'active', 'paused');
    expect(paused.status).toBe('paused');

    const resumed = await transitionReleaseRun(app.db, result.releaseRunId, 'paused', 'active');
    expect(resumed.status).toBe('active');
  });

  it('isTerminalReleaseRunStatus identifies terminal states', () => {
    expect(isTerminalReleaseRunStatus('completed')).toBe(true);
    expect(isTerminalReleaseRunStatus('cancelled')).toBe(true);
    expect(isTerminalReleaseRunStatus('active')).toBe(false);
    expect(isTerminalReleaseRunStatus('paused')).toBe(false);
    expect(isTerminalReleaseRunStatus('failed')).toBe(false);
  });

  it('worker recovery emits recovery audit events with no PII', async () => {
    const { userId, switchId } = await seedUserWithSwitch(app);

    await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });

    await recoverActiveReleaseRuns(app.db);

    const events = await app.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.eventType, 'worker_recovery_started'));

    expect(events.length).toBeGreaterThanOrEqual(1);

    // No PII in audit metadata
    const metaStr = JSON.stringify(events[0].metadata ?? {});
    expect(metaStr).not.toContain('email');
    expect(metaStr).not.toContain('name');
    expect(metaStr).toContain('activeRunCount');
  });
});
