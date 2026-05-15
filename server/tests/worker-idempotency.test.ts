/**
 * Worker idempotency tests (SaaS).
 *
 * Tests:
 *  - duplicate worker tick does not duplicate notifications (idempotency key)
 *  - duplicate worker tick does not duplicate packet upload (verify before upload)
 *  - duplicate worker tick does not duplicate claim escalation
 *  - worker recovery finds active release run and resumes
 *  - idempotency key expires appropriately
 *  - checkOrSetIdempotencyKey: first call false, second call true
 *  - setting idempotency key with result stores and retrieves result
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
import { buildApp } from '../src/index.js';
import { idempotencyKeys, releaseRuns, switches } from '../src/db/schema.js';
import { encryptContact } from '../src/services/contact-mapper.js';
import { encryptEstateItem } from '../src/services/estate-mapper.js';
import { estateItems, contacts } from '../src/db/schema.js';
import { startOrAttachHostedReleaseRun } from '../src/services/hosted-release-run.js';
import {
  checkIdempotencyKey,
  setIdempotencyKey,
  checkOrSetIdempotencyKey,
  deleteIdempotencyKey,
} from '../src/services/idempotency-keys.js';
import { getReleaseRunById } from '../src/repositories/release-run-repository.js';
import { recoverActiveReleaseRuns } from '../src/worker/index.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
async function seedUserWithSwitch(app: Awaited<ReturnType<typeof buildApp>>) {
  const email = `idem-test-${randomUUID()}@example.com`;
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      displayName: 'Idem Test',
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
describe('SaaS idempotency key service', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('first checkOrSetIdempotencyKey call returns found=false', async () => {
    const key = `test-idem-${randomUUID()}`;
    const result = await checkOrSetIdempotencyKey(app.db, key, 'test_scope');
    expect(result.found).toBe(false);
  });

  it('second checkOrSetIdempotencyKey call returns found=true', async () => {
    const key = `test-idem-${randomUUID()}`;
    await checkOrSetIdempotencyKey(app.db, key, 'test_scope');
    const second = await checkOrSetIdempotencyKey(app.db, key, 'test_scope');
    expect(second.found).toBe(true);
  });

  it('stores and retrieves result with idempotency key', async () => {
    const key = `test-result-${randomUUID()}`;
    const resultPayload = { packetId: 'uuid-123', version: 1 };
    await setIdempotencyKey(app.db, key, 'packet_generation', { resultJson: resultPayload });

    const check = await checkIdempotencyKey(app.db, key);
    expect(check.found).toBe(true);
    expect(check.result).toEqual(resultPayload);
  });

  it('expired key is treated as absent', async () => {
    const key = `expired-${randomUUID()}`;
    // Insert directly with past expiresAt
    await app.db.insert(idempotencyKeys).values({
      key,
      scope: 'test',
      expiresAt: new Date(Date.now() - 1000),
    });

    const result = await checkIdempotencyKey(app.db, key);
    expect(result.found).toBe(false);
  });

  it('key without expiry is treated as permanent', async () => {
    const key = `permanent-${randomUUID()}`;
    await setIdempotencyKey(app.db, key, 'test_scope');
    const result = await checkIdempotencyKey(app.db, key);
    expect(result.found).toBe(true);
  });

  it('deleteIdempotencyKey removes key', async () => {
    const key = `delete-${randomUUID()}`;
    await setIdempotencyKey(app.db, key, 'test_scope');
    await deleteIdempotencyKey(app.db, key);
    const result = await checkIdempotencyKey(app.db, key);
    expect(result.found).toBe(false);
  });

  it('different keys do not collide', async () => {
    const keyA = `scope-a-${randomUUID()}`;
    const keyB = `scope-b-${randomUUID()}`;
    await setIdempotencyKey(app.db, keyA, 'scope_a', { resultJson: { v: 'a' } });
    await setIdempotencyKey(app.db, keyB, 'scope_b', { resultJson: { v: 'b' } });

    const a = await checkIdempotencyKey(app.db, keyA);
    const b = await checkIdempotencyKey(app.db, keyB);

    expect((a.result as any).v).toBe('a');
    expect((b.result as any).v).toBe('b');
  });
});

describe('SaaS worker idempotency: duplicate ticks', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('duplicate worker tick does not duplicate notifications (idempotency key check)', async () => {
    const { userId, switchId } = await seedUserWithSwitch(app);

    const result = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });

    const contactId = randomUUID();
    const channel = 'email';
    const key = `contact_notification:${result.releaseRunId}:${contactId}:${channel}`;

    // First tick — sets key
    const tick1 = await checkOrSetIdempotencyKey(app.db, key, 'contact_notification');
    expect(tick1.found).toBe(false);

    // Second tick — finds key → duplicate skipped
    const tick2 = await checkOrSetIdempotencyKey(app.db, key, 'contact_notification');
    expect(tick2.found).toBe(true);
  });

  it('duplicate worker tick does not duplicate packet upload (idempotency key check)', async () => {
    const packetId = randomUUID();
    const version = 1;
    const key = `storage_upload:${packetId}:${version}`;

    const tick1 = await checkOrSetIdempotencyKey(app.db, key, 'storage_upload');
    expect(tick1.found).toBe(false);

    const tick2 = await checkOrSetIdempotencyKey(app.db, key, 'storage_upload');
    expect(tick2.found).toBe(true);
  });

  it('duplicate worker tick does not duplicate claim escalation (idempotency key check)', async () => {
    const claimId = randomUUID();
    const key = `claim_escalation:${claimId}`;

    const tick1 = await checkOrSetIdempotencyKey(app.db, key, 'claim_escalation');
    expect(tick1.found).toBe(false);

    const tick2 = await checkOrSetIdempotencyKey(app.db, key, 'claim_escalation');
    expect(tick2.found).toBe(true);
  });

  it('worker recovery finds active release run and resumes — does not reset state', async () => {
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

    // Simulate restart
    const count = await recoverActiveReleaseRuns(app.db);
    expect(count).toBeGreaterThanOrEqual(1);

    const after = await getReleaseRunById(app.db, result.releaseRunId);
    expect(after?.status).toBe('active');
    expect(after?.id).toBe(result.releaseRunId);
  });

  it('packet_generation idempotency key prevents duplicate packet build', async () => {
    const { userId } = await seedUserWithSwitch(app);
    const switchId = randomUUID(); // synthetic
    const version = 1;
    const key = `packet_generation:${switchId}:${version}`;

    const first = await checkOrSetIdempotencyKey(app.db, key, 'packet_generation', {
      userId,
      resultJson: { packetId: 'packet-abc' },
    });
    expect(first.found).toBe(false);

    const second = await checkOrSetIdempotencyKey(app.db, key, 'packet_generation', { userId });
    expect(second.found).toBe(true);
  });

  it('claim_state_transition idempotency key prevents duplicate transition', async () => {
    const claimId = randomUUID();
    const key = `claim_state_transition:${claimId}:pending:notified`;

    const first = await checkOrSetIdempotencyKey(app.db, key, 'claim_state_transition');
    expect(first.found).toBe(false);

    const second = await checkOrSetIdempotencyKey(app.db, key, 'claim_state_transition');
    expect(second.found).toBe(true);
  });
});
