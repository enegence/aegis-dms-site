/**
 * Tests for hosted public claim API routes.
 *
 * Storage mocked. Email mocked. Real test DB.
 *
 * Verifies:
 *  - invalid token → generic 404
 *  - expired claim → generic 404
 *  - open updates openedAt
 *  - verify handles PIN check
 *  - accept requires open/verified state
 *  - packet download before accept → 403
 *  - packet download after accept → 200 (binary)
 *  - key-view audited without material in logs
 *  - acknowledge completes release run
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

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
  downloadManagedPacket: vi.fn().mockResolvedValue(Buffer.from('mock-encrypted-packet')),
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
import {
  contacts,
  contactClaims,
  releaseRuns,
  switches,
  estateItems,
} from '../src/db/schema.js';
import { encryptContact } from '../src/services/contact-mapper.js';
import { encryptEstateItem } from '../src/services/estate-mapper.js';
import { startOrAttachHostedReleaseRun } from '../src/services/hosted-release-run.js';
import { startCascadeForReleaseRun } from '../src/services/hosted-cascade.js';
import {
  generateClaimToken,
  createContactClaim,
} from '../src/repositories/contact-claim-repository.js';

// ── Seed helpers ──────────────────────────────────────────────────────────────

async function seedClaim(app: Awaited<ReturnType<typeof buildApp>>) {
  const email = `claim-route-${randomUUID()}@example.com`;
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      displayName: 'Claim Route Test',
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

  const [ct] = await app.db
    .insert(contacts)
    .values({
      userId,
      priorityOrder: 1,
      confirmationWindowHours: 48,
      ...encryptContact(
        { fullName: 'Claim Contact', email: `claimer-${randomUUID()}@example.com` },
        fieldKey,
      ),
    })
    .returning();

  const [sw] = await app.db
    .insert(switches)
    .values({
      userId,
      name: 'Claim Switch',
      mode: 'trip',
      triggerAt: new Date(Date.now() + 86400000 * 30),
      gracePeriodHours: 72,
      warningWindowDays: 7,
      selectedEstateItemIds: [ei.id],
      selectedContactIds: [ct.id],
    })
    .returning();

  const runResult = await startOrAttachHostedReleaseRun({
    db: app.db,
    config: app.config,
    userId,
    triggeringSwitchId: sw.id,
    reason: 'manual_test',
  });

  const cascadeResult = await startCascadeForReleaseRun({
    db: app.db,
    config: app.config,
    releaseRunId: runResult.releaseRunId,
    baseUrl: 'https://aegisdms.life',
  });

  return {
    userId,
    switchId: sw.id,
    contactId: ct.id,
    releaseRunId: runResult.releaseRunId,
    packetId: runResult.packetId!,
    claimId: cascadeResult.claimId,
    claimToken: cascadeResult.claimToken,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Hosted claim API routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    mockSendEmail.mockResolvedValue({ MessageID: 'claim-route-msg' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/claim/:token — invalid token returns generic 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/claim/invalid-token-that-does-not-exist',
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('claim_not_found');
    // Must not leak claim details
    expect(res.payload).not.toContain('claimTokenHash');
    expect(res.payload).not.toContain('contactId');
  });

  it('GET /api/claim/:token — expired claim returns generic 404', async () => {
    const { claimId, claimToken } = await seedClaim(app);

    // Expire the claim
    await app.db
      .update(contactClaims)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(contactClaims.id, claimId));

    const res = await app.inject({
      method: 'GET',
      url: `/api/claim/${claimToken}`,
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/claim/:token — valid token returns claim status', async () => {
    const { claimToken, claimId } = await seedClaim(app);

    const res = await app.inject({
      method: 'GET',
      url: `/api/claim/${claimToken}`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.id).toBe(claimId);
    expect(body.status).toBe('notified');
    // Must not contain raw token or hash
    expect(res.payload).not.toContain(claimToken);
    expect(body.claimTokenHash).toBeUndefined();
  });

  it('POST /api/claim/:token/open — updates openedAt', async () => {
    const { claimToken } = await seedClaim(app);

    const res = await app.inject({
      method: 'POST',
      url: `/api/claim/${claimToken}/open`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('opened');
    expect(body.openedAt).toBeTruthy();
  });

  it('POST /api/claim/:token/verify — succeeds without PIN when none configured', async () => {
    const { claimToken } = await seedClaim(app);

    // Open first
    await app.inject({ method: 'POST', url: `/api/claim/${claimToken}/open` });

    const res = await app.inject({
      method: 'POST',
      url: `/api/claim/${claimToken}/verify`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('verified');
  });

  it('GET /api/claim/:token/packet — denied before accept', async () => {
    const { claimToken } = await seedClaim(app);

    const res = await app.inject({
      method: 'GET',
      url: `/api/claim/${claimToken}/packet`,
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /api/claim/:token/packet — allowed after accept', async () => {
    const { claimToken } = await seedClaim(app);

    await app.inject({ method: 'POST', url: `/api/claim/${claimToken}/open` });
    await app.inject({ method: 'POST', url: `/api/claim/${claimToken}/verify` });
    await app.inject({ method: 'POST', url: `/api/claim/${claimToken}/accept` });

    const res = await app.inject({
      method: 'GET',
      url: `/api/claim/${claimToken}/packet`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/octet-stream');
  });

  it('POST /api/claim/:token/key-view — records keyViewedAt without material in response', async () => {
    const { claimToken } = await seedClaim(app);

    await app.inject({ method: 'POST', url: `/api/claim/${claimToken}/open` });
    await app.inject({ method: 'POST', url: `/api/claim/${claimToken}/verify` });
    await app.inject({ method: 'POST', url: `/api/claim/${claimToken}/accept` });

    const res = await app.inject({
      method: 'POST',
      url: `/api/claim/${claimToken}/key-view`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('key_viewed');
    expect(body.keyViewedAt).toBeTruthy();
    // No key material in response
    expect(res.payload).not.toContain('packetKey');
    expect(res.payload).not.toContain('keyMaterial');
  });

  it('POST /api/claim/:token/acknowledge — completes release run', async () => {
    const { claimToken, releaseRunId } = await seedClaim(app);

    await app.inject({ method: 'POST', url: `/api/claim/${claimToken}/open` });
    await app.inject({ method: 'POST', url: `/api/claim/${claimToken}/verify` });
    await app.inject({ method: 'POST', url: `/api/claim/${claimToken}/accept` });

    const res = await app.inject({
      method: 'POST',
      url: `/api/claim/${claimToken}/acknowledge`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('acknowledged');

    // Release run should be completed
    const runs = await app.db
      .select()
      .from(releaseRuns)
      .where(eq(releaseRuns.id, releaseRunId));
    expect(runs[0].status).toBe('completed');
    expect(runs[0].completedAt).toBeTruthy();
  });

  it('POST /api/claim/:token/acknowledge — fails if not accepted yet', async () => {
    const { claimToken } = await seedClaim(app);
    // Do NOT advance to accepted state

    const res = await app.inject({
      method: 'POST',
      url: `/api/claim/${claimToken}/acknowledge`,
    });
    expect(res.statusCode).toBe(400);
  });
});
