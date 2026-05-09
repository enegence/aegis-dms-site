/**
 * Tests for hosted release run service.
 *
 * Storage is mocked. Real test DB used for all queries.
 *
 * Verifies:
 *  - triggered hosted switch creates new release run
 *  - duplicate trigger attaches to existing active run (no parallel cascades)
 *  - packet generated and linked on new run
 *  - completed run allows a subsequent new run
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';

// ── Mock storage before any imports ─────────────────────────────────────────
vi.mock('../src/services/storage/index.js', () => ({
  uploadManagedPacket: vi.fn().mockResolvedValue({
    storageObjectKey: 'packets/users/u/release-runs/rr/packets/p-v1.aegis.enc',
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

// ── Imports (after mocks) ────────────────────────────────────────────────────
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/index.js';
import { switches, releaseRuns, packets } from '../src/db/schema.js';
import { encryptContact } from '../src/services/contact-mapper.js';
import { encryptEstateItem } from '../src/services/estate-mapper.js';
import { estateItems, contacts } from '../src/db/schema.js';
import {
  startOrAttachHostedReleaseRun,
} from '../src/services/hosted-release-run.js';
import { updateReleaseRun } from '../src/repositories/release-run-repository.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

async function seedUserWithSwitch(
  app: Awaited<ReturnType<typeof buildApp>>,
) {
  const email = `rr-test-${randomUUID()}@example.com`;
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      displayName: 'Release Run Test',
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

  // Insert an estate item
  const [ei] = await app.db
    .insert(estateItems)
    .values({
      userId,
      ...encryptEstateItem(
        { category: 'financial', title: 'Test Account', institutionName: 'Bank' },
        fieldKey,
      ),
    })
    .returning();

  // Insert a contact
  const [ct] = await app.db
    .insert(contacts)
    .values({
      userId,
      priorityOrder: 1,
      confirmationWindowHours: 48,
      ...encryptContact(
        { fullName: 'Jane Doe', email: 'jane@example.com' },
        fieldKey,
      ),
    })
    .returning();

  // Insert a switch
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

describe('Hosted release run service', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a new release run when none is active', async () => {
    const { userId, switchId } = await seedUserWithSwitch(app);

    const result = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });

    expect(result.isNew).toBe(true);
    expect(result.releaseRunId).toBeTruthy();
    expect(result.suppressedSwitchIds).toEqual([]);

    // Verify run in DB
    const runs = await app.db
      .select()
      .from(releaseRuns)
      .where(eq(releaseRuns.id, result.releaseRunId));

    expect(runs.length).toBe(1);
    expect(runs[0].userId).toBe(userId);
    expect(runs[0].source).toBe('hosted');
    expect(runs[0].status).toBe('active');
  });

  it('generates and links a packet on a new run', async () => {
    const { userId, switchId } = await seedUserWithSwitch(app);

    const result = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });

    expect(result.packetId).toBeTruthy();

    // Run's activePacketId should be set
    const runs = await app.db
      .select()
      .from(releaseRuns)
      .where(eq(releaseRuns.id, result.releaseRunId));

    expect(runs[0].activePacketId).toBe(result.packetId);

    // Packet should exist in DB
    const pktRows = await app.db
      .select()
      .from(packets)
      .where(eq(packets.id, result.packetId!));

    expect(pktRows.length).toBe(1);
    expect(pktRows[0].userId).toBe(userId);
  });

  it('attaches to existing active run on duplicate trigger — no new run created', async () => {
    const { userId, switchId } = await seedUserWithSwitch(app);

    // First trigger
    const first = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });
    expect(first.isNew).toBe(true);

    // Second trigger (same switch — duplicate)
    const second = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });

    expect(second.isNew).toBe(false);
    expect(second.releaseRunId).toBe(first.releaseRunId);
    expect(second.suppressedSwitchIds).toContain(switchId);

    // Only one run exists for this user
    const runs = await app.db
      .select()
      .from(releaseRuns)
      .where(eq(releaseRuns.userId, userId));

    expect(runs.length).toBe(1);
  });

  it('attaches a second switch trigger to the same active run', async () => {
    const { userId, switchId: switchId1 } = await seedUserWithSwitch(app);

    // Create second switch for same user
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

    // First trigger creates a run
    const first = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId1,
      reason: 'trip_triggered',
    });

    // Second switch also triggers → attaches to same run
    const second = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: sw2.id,
      reason: 'trip_triggered',
    });

    expect(second.isNew).toBe(false);
    expect(second.releaseRunId).toBe(first.releaseRunId);
    expect(second.suppressedSwitchIds).toContain(sw2.id);
  });

  it('allows a new run after previous run is completed', async () => {
    const { userId, switchId } = await seedUserWithSwitch(app);

    // Start first run
    const first = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });
    expect(first.isNew).toBe(true);

    // Mark first run completed
    await updateReleaseRun(app.db, first.releaseRunId, {
      status: 'completed',
      completedAt: new Date(),
    });

    // New trigger — should create a new run
    const second = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'manual_test',
    });

    expect(second.isNew).toBe(true);
    expect(second.releaseRunId).not.toBe(first.releaseRunId);

    // Two runs total for this user
    const runs = await app.db
      .select()
      .from(releaseRuns)
      .where(eq(releaseRuns.userId, userId));

    expect(runs.length).toBe(2);
  });
});
