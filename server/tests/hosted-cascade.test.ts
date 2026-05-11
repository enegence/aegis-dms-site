/**
 * Tests for hosted contact cascade.
 *
 * Storage and email transports are mocked.
 * Real test DB used for all queries.
 *
 * Verifies:
 *  - cascade starts with priority contact
 *  - claim token is hash-only in DB (raw token returned to caller only)
 *  - notification is sent
 *  - expired claim escalates to next contact
 *  - all contacts exhausted marks release run failed
 *  - acknowledged claim completes release run
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

const mockSendEmail = vi.fn();
vi.mock('postmark', () => {
  class FakeServerClient {
    sendEmail = mockSendEmail;
  }
  return { ServerClient: FakeServerClient };
});

// ── Imports ───────────────────────────────────────────────────────────────────

import { eq } from 'drizzle-orm';
import { buildApp } from '../src/index.js';
import { contacts, contactClaims, releaseRuns, switches, estateItems } from '../src/db/schema.js';
import { encryptContact } from '../src/services/contact-mapper.js';
import { encryptEstateItem } from '../src/services/estate-mapper.js';
import {
  startCascadeForReleaseRun,
  escalateClaim,
  acknowledgeClaim,
} from '../src/services/hosted-cascade.js';
import { startOrAttachHostedReleaseRun } from '../src/services/hosted-release-run.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function seedUserWithContacts(
  app: Awaited<ReturnType<typeof buildApp>>,
  contactCount = 2,
) {
  const email = `cascade-test-${randomUUID()}@example.com`;
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      displayName: 'Cascade Test',
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

  // Insert estate item
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

  // Insert contacts with priority order 1..N
  const contactIds: string[] = [];
  for (let i = 1; i <= contactCount; i++) {
    const [ct] = await app.db
      .insert(contacts)
      .values({
        userId,
        priorityOrder: i,
        confirmationWindowHours: 1,
        ...encryptContact(
          {
            fullName: `Contact ${i}`,
            email: `contact${i}-${randomUUID()}@example.com`,
          },
          fieldKey,
        ),
      })
      .returning();
    contactIds.push(ct.id);
  }

  // Insert switch with all contacts
  const [sw] = await app.db
    .insert(switches)
    .values({
      userId,
      name: 'Cascade Switch',
      mode: 'trip',
      triggerAt: new Date(Date.now() + 86400000 * 30),
      gracePeriodHours: 72,
      warningWindowDays: 7,
      selectedEstateItemIds: [ei.id],
      selectedContactIds: contactIds,
    })
    .returning();

  return { userId, switchId: sw.id, contactIds };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Hosted contact cascade', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    mockSendEmail.mockResolvedValue({ MessageID: 'mock-msg-001' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('starts cascade with the priority-1 contact', async () => {
    const { userId, switchId, contactIds } = await seedUserWithContacts(app, 2);

    // Create a release run with a packet
    const runResult = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });

    const cascadeResult = await startCascadeForReleaseRun({
      db: app.db,
      config: app.config,
      releaseRunId: runResult.releaseRunId,
      baseUrl: 'https://aegisdms.life',
    });

    // Should be first contact (priority 1)
    expect(cascadeResult.contactId).toBe(contactIds[0]);
    expect(cascadeResult.claimId).toBeTruthy();
    expect(cascadeResult.claimToken).toBeTruthy();
  });

  it('stores only the token hash in DB — not the raw token', async () => {
    const { userId, switchId } = await seedUserWithContacts(app, 1);

    const runResult = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });

    const cascadeResult = await startCascadeForReleaseRun({
      db: app.db,
      config: app.config,
      releaseRunId: runResult.releaseRunId,
      baseUrl: 'https://aegisdms.life',
    });

    const rows = await app.db
      .select()
      .from(contactClaims)
      .where(eq(contactClaims.id, cascadeResult.claimId));

    expect(rows.length).toBe(1);
    const claim = rows[0];

    // Stored token must be the SHA-256 hash of the raw token
    const expectedHash = createHash('sha256')
      .update(cascadeResult.claimToken)
      .digest('hex');

    expect(claim.claimTokenHash).toBe(expectedHash);
    expect(claim.claimTokenHash).not.toBe(cascadeResult.claimToken);

    // Raw token must not appear anywhere in the stored claim
    const claimStr = JSON.stringify(claim);
    expect(claimStr).not.toContain(cascadeResult.claimToken);
  });

  it('sends a claim notification to the contact', async () => {
    mockSendEmail.mockClear();
    const { userId, switchId } = await seedUserWithContacts(app, 1);

    const runResult = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });

    // Use a config with a real postmark token so the mock is triggered
    const cfg = {
      ...app.config,
      postmark: { ...app.config.postmark, apiToken: 'fake-postmark-token' },
    };

    await startCascadeForReleaseRun({
      db: app.db,
      config: cfg,
      releaseRunId: runResult.releaseRunId,
      baseUrl: 'https://aegisdms.life',
    });

    expect(mockSendEmail).toHaveBeenCalled();
  });

  it('claim status becomes notified after cascade start', async () => {
    const { userId, switchId } = await seedUserWithContacts(app, 1);

    const runResult = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });

    const result = await startCascadeForReleaseRun({
      db: app.db,
      config: app.config,
      releaseRunId: runResult.releaseRunId,
      baseUrl: 'https://aegisdms.life',
    });

    const rows = await app.db
      .select()
      .from(contactClaims)
      .where(eq(contactClaims.id, result.claimId));

    expect(rows[0].status).toBe('notified');
    expect(rows[0].notifiedAt).not.toBeNull();
  });

  it('escalates to next contact when current claim times out', async () => {
    const { userId, switchId, contactIds } = await seedUserWithContacts(app, 2);

    const runResult = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });

    const first = await startCascadeForReleaseRun({
      db: app.db,
      config: app.config,
      releaseRunId: runResult.releaseRunId,
      baseUrl: 'https://aegisdms.life',
    });

    const escalateResult = await escalateClaim({
      db: app.db,
      config: app.config,
      claimId: first.claimId,
      baseUrl: 'https://aegisdms.life',
    });

    expect(escalateResult.escalated).toBe(true);
    if (escalateResult.escalated) {
      expect(escalateResult.nextClaimId).toBeTruthy();
      // Next claim should be for contact 2
      const nextClaim = await app.db
        .select()
        .from(contactClaims)
        .where(eq(contactClaims.id, escalateResult.nextClaimId));
      expect(nextClaim[0].contactId).toBe(contactIds[1]);
    }

    // First claim should be escalated
    const firstClaim = await app.db
      .select()
      .from(contactClaims)
      .where(eq(contactClaims.id, first.claimId));
    expect(firstClaim[0].status).toBe('escalated');
    expect(firstClaim[0].escalatedAt).not.toBeNull();
  });

  it('marks release run failed when all contacts are exhausted', async () => {
    const { userId, switchId } = await seedUserWithContacts(app, 1);

    const runResult = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });

    const first = await startCascadeForReleaseRun({
      db: app.db,
      config: app.config,
      releaseRunId: runResult.releaseRunId,
      baseUrl: 'https://aegisdms.life',
    });

    // Escalate the only contact → exhausted
    const escalateResult = await escalateClaim({
      db: app.db,
      config: app.config,
      claimId: first.claimId,
      baseUrl: 'https://aegisdms.life',
    });

    expect(escalateResult.escalated).toBe(false);
    if (!escalateResult.escalated) {
      expect(escalateResult.failed).toBe(true);
    }

    // Release run should be failed
    const runs = await app.db
      .select()
      .from(releaseRuns)
      .where(eq(releaseRuns.id, runResult.releaseRunId));
    expect(runs[0].status).toBe('failed');
  });

  it('acknowledged claim completes the release run', async () => {
    const { userId, switchId } = await seedUserWithContacts(app, 1);

    const runResult = await startOrAttachHostedReleaseRun({
      db: app.db,
      config: app.config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });

    const cascadeResult = await startCascadeForReleaseRun({
      db: app.db,
      config: app.config,
      releaseRunId: runResult.releaseRunId,
      baseUrl: 'https://aegisdms.life',
    });

    // Manually advance claim through the required access steps so ack is valid
    const { updateContactClaim } = await import(
      '../src/repositories/contact-claim-repository.js'
    );
    await updateContactClaim(app.db, cascadeResult.claimId, {
      status: 'key_viewed',
      acceptedAt: new Date(),
      packetDownloadedAt: new Date(),
      keyViewedAt: new Date(),
    });

    await acknowledgeClaim(app.db, cascadeResult.claimId);

    // Claim acknowledged
    const claims = await app.db
      .select()
      .from(contactClaims)
      .where(eq(contactClaims.id, cascadeResult.claimId));
    expect(claims[0].status).toBe('acknowledged');
    expect(claims[0].acknowledgedAt).not.toBeNull();

    // Release run completed
    const runs = await app.db
      .select()
      .from(releaseRuns)
      .where(eq(releaseRuns.id, runResult.releaseRunId));
    expect(runs[0].status).toBe('completed');
    expect(runs[0].completedAt).not.toBeNull();

    const switchRows = await app.db
      .select()
      .from(switches)
      .where(eq(switches.id, switchId));
    expect(switchRows[0].status).toBe('completed');
  });
});
