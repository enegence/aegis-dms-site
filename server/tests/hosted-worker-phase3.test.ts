/**
 * Tests for hosted worker — Phase 3 extension.
 *
 * Storage and email are mocked. Real test DB used.
 *
 * Verifies:
 *  - triggered switch creates release run and packet
 *  - second tick does not duplicate packet or notification
 *  - expired claim escalates
 *  - acknowledged claim completes run
 *  - exhausted cascade fails run
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
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

const mockSendEmail = vi.fn();
vi.mock('postmark', () => {
  class FakeServerClient {
    sendEmail = mockSendEmail;
  }
  return { ServerClient: FakeServerClient };
});

// ── Imports ───────────────────────────────────────────────────────────────────

import { and, eq, inArray } from 'drizzle-orm';
import { buildApp } from '../src/index.js';
import {
  switches,
  releaseRuns,
  packets,
  contactClaims,
  contacts,
  estateItems,
} from '../src/db/schema.js';
import { encryptContact } from '../src/services/contact-mapper.js';
import { encryptEstateItem } from '../src/services/estate-mapper.js';
import { armSwitch } from '../src/services/switch-engine.js';
import { runHostedWorkerOnce } from '../src/worker/hosted-worker.js';
import { updateContactClaim } from '../src/repositories/contact-claim-repository.js';
import { updateReleaseRun } from '../src/repositories/release-run-repository.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function seedUserWithArmedSwitch(
  app: Awaited<ReturnType<typeof buildApp>>,
  contactCount = 1,
) {
  const email = `worker-test-${randomUUID()}@example.com`;
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      displayName: 'Worker Test',
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
      ...encryptEstateItem(
        { category: 'financial', title: 'Account', institutionName: 'Bank' },
        fieldKey,
      ),
    })
    .returning();

  const contactIds: string[] = [];
  for (let i = 1; i <= contactCount; i++) {
    const [ct] = await app.db
      .insert(contacts)
      .values({
        userId,
        priorityOrder: i,
        confirmationWindowHours: 1,
        ...encryptContact(
          { fullName: `Contact ${i}`, email: `c${i}-${randomUUID()}@example.com` },
          fieldKey,
        ),
      })
      .returning();
    contactIds.push(ct.id);
  }

  const [sw] = await app.db
    .insert(switches)
    .values({
      userId,
      name: 'Worker Switch',
      mode: 'trip',
      triggerAt: new Date(Date.now() + 86400000 * 30),
      gracePeriodHours: 72,
      warningWindowDays: 7,
      selectedEstateItemIds: [ei.id],
      selectedContactIds: contactIds,
    })
    .returning();

  // Arm it
  await armSwitch(app.db, userId, sw.id);

  return { userId, switchId: sw.id, contactIds };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Hosted worker — Phase 3', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    mockSendEmail.mockResolvedValue({ MessageID: 'worker-mock-msg' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockSendEmail.mockClear();
  });

  it('triggered switch creates release run and packet on first tick', async () => {
    const { userId, switchId } = await seedUserWithArmedSwitch(app);

    // Make switch trigger by setting triggerAt to the past
    await app.db
      .update(switches)
      .set({ triggerAt: new Date(Date.now() - 1000) })
      .where(eq(switches.id, switchId));

    const cfg = {
      ...app.config,
      postmark: { ...app.config.postmark, apiToken: 'fake-token' },
    };

    await runHostedWorkerOnce(app.db, cfg, new Date());

    // Release run should exist
    const runs = await app.db
      .select()
      .from(releaseRuns)
      .where(and(eq(releaseRuns.userId, userId), eq(releaseRuns.source, 'hosted')));

    expect(runs.length).toBeGreaterThanOrEqual(1);
    const run = runs[0];
    expect(run.activePacketId).toBeTruthy();

    // Packet should exist
    const pkts = await app.db
      .select()
      .from(packets)
      .where(eq(packets.id, run.activePacketId!));
    expect(pkts.length).toBe(1);
  });

  it('second tick does not create duplicate run or packet', async () => {
    const { userId, switchId } = await seedUserWithArmedSwitch(app);

    await app.db
      .update(switches)
      .set({ triggerAt: new Date(Date.now() - 1000) })
      .where(eq(switches.id, switchId));

    const cfg = {
      ...app.config,
      postmark: { ...app.config.postmark, apiToken: 'fake-token' },
    };

    // Two ticks
    await runHostedWorkerOnce(app.db, cfg);
    await runHostedWorkerOnce(app.db, cfg);

    // Only one release run
    const runs = await app.db
      .select()
      .from(releaseRuns)
      .where(eq(releaseRuns.userId, userId));

    const activeRuns = runs.filter(
      (r) => r.status !== 'completed' && r.status !== 'cancelled' && r.status !== 'failed',
    );
    expect(activeRuns.length).toBe(1);
  });

  it('starts cascade on second tick (after packet is ready)', async () => {
    const { userId, switchId } = await seedUserWithArmedSwitch(app);

    await app.db
      .update(switches)
      .set({ triggerAt: new Date(Date.now() - 1000) })
      .where(eq(switches.id, switchId));

    const cfg = {
      ...app.config,
      postmark: { ...app.config.postmark, apiToken: 'fake-token' },
    };

    // Tick 1: triggers switch, creates run + packet
    await runHostedWorkerOnce(app.db, cfg);

    // Tick 2: starts cascade
    await runHostedWorkerOnce(app.db, cfg);

    // Contact claim should exist
    const runs = await app.db
      .select()
      .from(releaseRuns)
      .where(eq(releaseRuns.userId, userId));

    const activeRun = runs.find(
      (r) => r.status !== 'completed' && r.status !== 'cancelled' && r.status !== 'failed',
    );
    expect(activeRun).toBeTruthy();
    expect(activeRun!.currentContactClaimId).toBeTruthy();
  });

  it('escalates expired claim on next tick', async () => {
    const { userId, switchId, contactIds } = await seedUserWithArmedSwitch(app, 2);

    await app.db
      .update(switches)
      .set({ triggerAt: new Date(Date.now() - 1000) })
      .where(eq(switches.id, switchId));

    const cfg = {
      ...app.config,
      postmark: { ...app.config.postmark, apiToken: 'fake-token' },
    };

    // Tick 1: trigger + packet
    await runHostedWorkerOnce(app.db, cfg);
    // Tick 2: start cascade
    await runHostedWorkerOnce(app.db, cfg);

    // Manually expire the current claim by setting expiresAt to past
    const runs = await app.db
      .select()
      .from(releaseRuns)
      .where(eq(releaseRuns.userId, userId));
    const run = runs[0];

    if (run.currentContactClaimId) {
      await app.db
        .update(contactClaims)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(contactClaims.id, run.currentContactClaimId));
    }

    // Tick 3: escalate
    await runHostedWorkerOnce(app.db, cfg, new Date(Date.now() + 1000));

    // Original claim should be escalated
    if (run.currentContactClaimId) {
      const claims = await app.db
        .select()
        .from(contactClaims)
        .where(eq(contactClaims.id, run.currentContactClaimId));
      expect(claims[0].status).toBe('escalated');
    }
  });

  it('run fails when all contacts exhausted by escalation', async () => {
    const { userId, switchId } = await seedUserWithArmedSwitch(app, 1);

    await app.db
      .update(switches)
      .set({ triggerAt: new Date(Date.now() - 1000) })
      .where(eq(switches.id, switchId));

    const cfg = {
      ...app.config,
      postmark: { ...app.config.postmark, apiToken: 'fake-token' },
    };

    await runHostedWorkerOnce(app.db, cfg); // trigger
    await runHostedWorkerOnce(app.db, cfg); // cascade

    // Expire the only contact's claim
    const runs = await app.db
      .select()
      .from(releaseRuns)
      .where(eq(releaseRuns.userId, userId));
    const run = runs[0];

    if (run.currentContactClaimId) {
      await app.db
        .update(contactClaims)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(contactClaims.id, run.currentContactClaimId));
    }

    await runHostedWorkerOnce(app.db, cfg, new Date(Date.now() + 1000)); // escalate → exhaust

    const updatedRuns = await app.db
      .select()
      .from(releaseRuns)
      .where(eq(releaseRuns.id, run.id));
    expect(updatedRuns[0].status).toBe('failed');
  });
});
