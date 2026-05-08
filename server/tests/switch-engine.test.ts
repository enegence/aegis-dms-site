import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/index.js';
import { switches, releaseRuns, auditEvents } from '../src/db/schema.js';
import { armSwitch, pauseSwitch, cancelSwitch, checkInSwitch, evaluateSwitch } from '../src/services/switch-engine.js';
import { getActiveReleaseRun } from '../src/services/switch-repository.js';

describe('Switch Engine', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    // Register user A
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        displayName: 'Switch Engine Test',
        email: 'switchengine@example.com',
        password: 'testpass12345',
        timezone: 'UTC',
      },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'switchengine@example.com', password: 'testpass12345' },
    });
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: String(loginRes.headers['set-cookie']) },
    });
    userId = JSON.parse(meRes.payload).id;

    // Register user B (for scoping test)
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        displayName: 'Switch Engine Other',
        email: 'switchengine-other@example.com',
        password: 'testpass12345',
        timezone: 'UTC',
      },
    });
    const otherLoginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'switchengine-other@example.com', password: 'testpass12345' },
    });
    const otherMeRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: String(otherLoginRes.headers['set-cookie']) },
    });
    otherUserId = JSON.parse(otherMeRes.payload).id;
  });

  afterAll(async () => {
    await app.close();
  });

  // Helper: insert a switch directly with controlled initial state
  async function insertSwitch(
    overrides: Partial<typeof switches.$inferInsert> & { userId: string },
  ) {
    const rows = await app.db
      .insert(switches)
      .values({
        name: 'Test Switch',
        mode: 'trip',
        status: 'draft',
        gracePeriodHours: 72,
        warningWindowDays: 3,
        selectedContactIds: [],
        selectedEstateItemIds: [],
        ...overrides,
      })
      .returning();
    return rows[0]!;
  }

  it('1. Arm trip switch — warningStartsAt computed correctly', async () => {
    const triggerAt = new Date(Date.now() + 7 * 86400000); // 7 days from now
    const sw = await insertSwitch({ userId, mode: 'trip', triggerAt, warningWindowDays: 3 });

    const updated = await armSwitch(app.db, userId, sw.id);

    expect(updated.status).toBe('armed');
    expect(updated.warningStartsAt).toBeDefined();
    const expectedWarningMs = triggerAt.getTime() - 3 * 86400000;
    expect(Math.abs(new Date(updated.warningStartsAt!).getTime() - expectedWarningMs)).toBeLessThan(1000);
  });

  it('2. Arm heartbeat switch — nextCheckInDueAt ≈ now + 1 day', async () => {
    const before = Date.now();
    const sw = await insertSwitch({ userId, mode: 'heartbeat', heartbeatIntervalDays: 1 });

    const updated = await armSwitch(app.db, userId, sw.id);

    expect(updated.status).toBe('armed');
    expect(updated.nextCheckInDueAt).toBeDefined();
    const dueMs = new Date(updated.nextCheckInDueAt!).getTime();
    const expectedMs = before + 1 * 86400000;
    // Allow 5 seconds of slack
    expect(Math.abs(dueMs - expectedMs)).toBeLessThan(5000);
  });

  it('3. Pause switch — armed → paused', async () => {
    const sw = await insertSwitch({ userId, mode: 'trip', triggerAt: new Date(Date.now() + 7 * 86400000) });
    await armSwitch(app.db, userId, sw.id);

    const updated = await pauseSwitch(app.db, userId, sw.id);

    expect(updated.status).toBe('paused');
  });

  it('4. Cancel switch — armed → cancelled', async () => {
    const sw = await insertSwitch({ userId, mode: 'trip', triggerAt: new Date(Date.now() + 7 * 86400000) });
    await armSwitch(app.db, userId, sw.id);

    const updated = await cancelSwitch(app.db, userId, sw.id);

    expect(updated.status).toBe('cancelled');
  });

  it('5. Check-in resets timer', async () => {
    const sw = await insertSwitch({ userId, mode: 'heartbeat', heartbeatIntervalDays: 1 });
    await armSwitch(app.db, userId, sw.id);

    const before = Date.now();
    const updated = await checkInSwitch(app.db, userId, sw.id);

    expect(updated.lastCheckInAt).toBeDefined();
    expect(updated.nextCheckInDueAt).toBeDefined();
    const dueMs = new Date(updated.nextCheckInDueAt!).getTime();
    const expectedMs = before + 1 * 86400000;
    expect(Math.abs(dueMs - expectedMs)).toBeLessThan(5000);
  });

  it('6. Trip evaluate: warning transition', async () => {
    // triggerAt = 2 days from now, warningWindowDays = 3 → warningStartsAt = yesterday
    const triggerAt = new Date(Date.now() + 2 * 86400000);
    const sw = await insertSwitch({ userId, mode: 'trip', triggerAt, warningWindowDays: 3 });
    await armSwitch(app.db, userId, sw.id);

    // Evaluate with "now" set to after warningStartsAt but before triggerAt
    const evaluateNow = new Date(triggerAt.getTime() - 1 * 86400000); // 1 day before trigger = yesterday-ish
    const updated = await evaluateSwitch(app.db, userId, sw.id, evaluateNow);

    expect(updated.status).toBe('warning');
  });

  it('7. Trip evaluate: triggered transition', async () => {
    // triggerAt in the past
    const triggerAt = new Date(Date.now() - 1000);
    const sw = await insertSwitch({ userId, mode: 'trip', triggerAt, warningWindowDays: 3 });
    await armSwitch(app.db, userId, sw.id);

    // Cancel any existing active release run first (from previous tests) so this one can create its own
    const existingRun = await getActiveReleaseRun(app.db, userId);
    if (existingRun) {
      await app.db
        .update(releaseRuns)
        .set({ status: 'cancelled', cancelledAt: new Date() })
        .where(eq(releaseRuns.id, existingRun.id));
    }

    const evaluateNow = new Date(triggerAt.getTime() + 2000); // just past trigger
    const updated = await evaluateSwitch(app.db, userId, sw.id, evaluateNow);

    expect(updated.status).toBe('triggered');

    // Verify release run was created
    const run = await getActiveReleaseRun(app.db, userId);
    expect(run).not.toBeNull();
    expect(run!.triggeringSwitchId).toBe(sw.id);
  });

  it('8. Heartbeat evaluate: warning transition', async () => {
    const sw = await insertSwitch({ userId, mode: 'heartbeat', heartbeatIntervalDays: 1 });
    await armSwitch(app.db, userId, sw.id);

    // Set nextCheckInDueAt to the past
    const pastDue = new Date(Date.now() - 1000);
    await app.db
      .update(switches)
      .set({ nextCheckInDueAt: pastDue })
      .where(eq(switches.id, sw.id));

    const updated = await evaluateSwitch(app.db, userId, sw.id);

    expect(updated.status).toBe('warning');
  });

  it('9. Release-run constraint — no second release run for same user', async () => {
    // Cancel existing runs first so test is clean
    await app.db
      .update(releaseRuns)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(releaseRuns.userId, userId));

    // First switch: trigger it (creates a run)
    const triggerAt1 = new Date(Date.now() - 1000);
    const sw1 = await insertSwitch({ userId, mode: 'trip', triggerAt: triggerAt1, warningWindowDays: 3 });
    await armSwitch(app.db, userId, sw1.id);
    await evaluateSwitch(app.db, userId, sw1.id, new Date(triggerAt1.getTime() + 2000));

    // Verify first run created
    const firstRun = await getActiveReleaseRun(app.db, userId);
    expect(firstRun).not.toBeNull();

    // Second switch: trigger it — should NOT create a second run
    const triggerAt2 = new Date(Date.now() - 1000);
    const sw2 = await insertSwitch({ userId, mode: 'trip', triggerAt: triggerAt2, warningWindowDays: 3 });
    await armSwitch(app.db, userId, sw2.id);
    await evaluateSwitch(app.db, userId, sw2.id, new Date(triggerAt2.getTime() + 2000));

    // sw2 should be triggered but only one active run
    const sw2Updated = await app.db
      .select()
      .from(switches)
      .where(eq(switches.id, sw2.id));
    expect(sw2Updated[0]!.status).toBe('triggered');

    const allRuns = await app.db
      .select()
      .from(releaseRuns)
      .where(eq(releaseRuns.userId, userId));
    const activeRuns = allRuns.filter(
      (r) => r.status !== 'completed' && r.status !== 'cancelled',
    );
    expect(activeRuns).toHaveLength(1);
    expect(activeRuns[0]!.triggeringSwitchId).toBe(sw1.id);
  });

  it('10. User scoping — armSwitch with wrong userId throws not_found', async () => {
    const sw = await insertSwitch({ userId });

    await expect(armSwitch(app.db, otherUserId, sw.id)).rejects.toThrow('not_found');
  });

  it('11. Audit metadata contains only switchId (no PII)', async () => {
    const triggerAt = new Date(Date.now() + 7 * 86400000);
    const sw = await insertSwitch({ userId, mode: 'trip', triggerAt, warningWindowDays: 3 });
    await armSwitch(app.db, userId, sw.id);

    // Find the most recent switch_armed audit event for this switch
    const events = await app.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.switchId, sw.id));

    const armedEvent = events.find((e) => e.eventType === 'switch_armed');
    expect(armedEvent).toBeDefined();
    expect(armedEvent!.metadata).toBeDefined();

    const metadata = armedEvent!.metadata as Record<string, unknown>;
    // Only switchId should be present — no PII fields
    expect(metadata.switchId).toBe(sw.id);
    const piiKeys = ['email', 'phone', 'fullName', 'name', 'password', 'secret', 'apiKey'];
    for (const key of piiKeys) {
      expect(metadata[key]).toBeUndefined();
    }
  });
});
