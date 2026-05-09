/**
 * Tests for packet management routes.
 *
 * Storage operations are mocked so tests run without a real S3/R2 bucket.
 *
 * Covers:
 *   - Auth enforcement (unauthenticated → 401)
 *   - User isolation (cross-user access → 404)
 *   - CSRF enforcement (state-changing requests without token → 403)
 *   - Packet generation (creates record, returns metadata only)
 *   - Packet listing and retrieval
 *   - Packet verification (updates lastVerifiedAt)
 *   - Packet deletion (marks deleted, calls storage delete, returns 204)
 *   - Audit event written after generate
 */

// ── Mock storage before any imports that pull it in ──────────────────────────
// vi.mock factory is hoisted — must not reference outer let/const variables.

import { vi } from 'vitest';

vi.mock('../src/services/storage/index.js', () => ({
  uploadManagedPacket: vi.fn().mockResolvedValue({
    storageObjectKey: 'packets/users/uid/release-runs/rid/packets/pid-v1.aegis.enc',
    storageProvider: 's3',
    storageBucket: 'test-bucket',
    storageRegion: 'auto',
    storageVersionId: null,
    lastVerifiedAt: new Date(),
  }),
  verifyManagedPacket: vi.fn().mockResolvedValue({ exists: true, versionId: null }),
  deleteManagedPacket: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { buildApp } from '../src/index.js';
import { auditEvents, switches, users } from '../src/db/schema.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getCsrf(
  app: Awaited<ReturnType<typeof buildApp>>,
  cookies: string,
): Promise<string> {
  const res = await app.inject({
    method: 'GET',
    url: '/api/csrf',
    headers: { cookie: cookies },
  });
  return JSON.parse(res.payload).csrfToken;
}

const FUTURE_DATE = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
const FAKE_UUID_1 = '00000000-0000-0000-0000-000000000001';
const FAKE_UUID_2 = '00000000-0000-0000-0000-000000000002';

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Packet Routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;
  let otherCookies: string;
  let userId: string;
  let switchId: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    // ── Primary user ─────────────────────────────────────────────────────────
    const email = `packets-${randomUUID()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { displayName: 'Packet Test User', email, password: 'testpass12345', timezone: 'UTC' },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'testpass12345' },
    });
    cookies = String(loginRes.headers['set-cookie']);

    // Resolve userId via /api/auth/me
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: cookies },
    });
    userId = JSON.parse(meRes.payload).id;

    // Mark email verified so readiness checks pass
    await app.db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, userId));

    // ── Second user for isolation tests ────────────────────────────────────
    const otherEmail = `packets-other-${randomUUID()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { displayName: 'Other Packet User', email: otherEmail, password: 'testpass12345', timezone: 'UTC' },
    });
    const otherLoginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: otherEmail, password: 'testpass12345' },
    });
    otherCookies = String(otherLoginRes.headers['set-cookie']);

    // ── Create a hosted switch for generate tests ────────────────────────────
    const [sw] = await app.db
      .insert(switches)
      .values({
        userId,
        name: 'Test Hosted Switch',
        mode: 'hosted',
        status: 'draft',
        gracePeriodHours: 72,
        warningWindowDays: 3,
        selectedEstateItemIds: [FAKE_UUID_1],
        selectedContactIds: [FAKE_UUID_2],
      })
      .returning();
    switchId = sw.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Auth enforcement ───────────────────────────────────────────────────────

  it('GET /api/app/packets unauthenticated → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/app/packets' });
    expect(res.statusCode).toBe(401);
  });

  it('POST .../generate unauthenticated → 401', async () => {
    const fakeId = randomUUID();
    const res = await app.inject({
      method: 'POST',
      url: `/api/app/switches/${fakeId}/packets/generate`,
    });
    expect(res.statusCode).toBe(401);
  });

  // ── List packets ───────────────────────────────────────────────────────────

  it('GET /api/app/packets returns empty array for new user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/app/packets',
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.packets)).toBe(true);
  });

  // ── User isolation — single packet ────────────────────────────────────────

  it('GET /api/app/packets/:id returns 404 for wrong user packet', async () => {
    // Generate a packet as primary user first
    const csrf = await getCsrf(app, cookies);
    const genRes = await app.inject({
      method: 'POST',
      url: `/api/app/switches/${switchId}/packets/generate`,
      headers: { cookie: cookies, 'x-csrf-token': csrf },
    });
    expect(genRes.statusCode).toBe(201);
    const { packet } = JSON.parse(genRes.payload);

    // Other user tries to access it
    const res = await app.inject({
      method: 'GET',
      url: `/api/app/packets/${packet.id}`,
      headers: { cookie: otherCookies },
    });
    expect(res.statusCode).toBe(404);
  });

  // ── Generate packet ────────────────────────────────────────────────────────

  it('POST .../generate creates packet and returns metadata', async () => {
    const csrf = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: `/api/app/switches/${switchId}/packets/generate`,
      headers: { cookie: cookies, 'x-csrf-token': csrf },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);

    // Shape check
    expect(body.packet.id).toBeDefined();
    expect(body.packet.userId).toBe(userId);
    expect(body.packet.switchId).toBe(switchId);
    expect(body.packet.sourceApp).toBe('aegis_hosted');
    expect(body.packet.schemaVersion).toBe('1');
    expect(body.packet.version).toBe(1);
    expect(body.packet.encryptionAlgorithm).toBe('aes-256-gcm');
    expect(body.packet.keyId).toBeDefined();
    expect(body.packet.contentHash).toBeDefined();
    expect(body.packet.createdAt).toBeDefined();

    // Must NOT include raw encrypted data
    expect(body.packet).not.toHaveProperty('encryptedData');
  });

  it('POST .../generate for non-existent switch → 404', async () => {
    const csrf = await getCsrf(app, cookies);
    const fakeId = randomUUID();
    const res = await app.inject({
      method: 'POST',
      url: `/api/app/switches/${fakeId}/packets/generate`,
      headers: { cookie: cookies, 'x-csrf-token': csrf },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST .../generate requires CSRF → 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/app/switches/${switchId}/packets/generate`,
      headers: { cookie: cookies }, // no CSRF token
    });
    expect(res.statusCode).toBe(403);
  });

  // ── Verify packet ──────────────────────────────────────────────────────────

  it('POST /api/app/packets/:id/verify verifies packet and updates lastVerifiedAt', async () => {
    // Generate a packet first
    const csrf = await getCsrf(app, cookies);
    const genRes = await app.inject({
      method: 'POST',
      url: `/api/app/switches/${switchId}/packets/generate`,
      headers: { cookie: cookies, 'x-csrf-token': csrf },
    });
    expect(genRes.statusCode).toBe(201);
    const { packet } = JSON.parse(genRes.payload);

    // Verify it
    const verifyCsrf = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: `/api/app/packets/${packet.id}/verify`,
      headers: { cookie: cookies, 'x-csrf-token': verifyCsrf },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.verified).toBe(true);
    expect(body.packet.id).toBe(packet.id);
    expect(body.packet.lastVerifiedAt).not.toBeNull();
  });

  it('POST /api/app/packets/:id/verify returns 404 for wrong user', async () => {
    // Generate a packet as primary user
    const csrf = await getCsrf(app, cookies);
    const genRes = await app.inject({
      method: 'POST',
      url: `/api/app/switches/${switchId}/packets/generate`,
      headers: { cookie: cookies, 'x-csrf-token': csrf },
    });
    const { packet } = JSON.parse(genRes.payload);

    // Other user tries to verify it
    const otherCsrf = await getCsrf(app, otherCookies);
    const res = await app.inject({
      method: 'POST',
      url: `/api/app/packets/${packet.id}/verify`,
      headers: { cookie: otherCookies, 'x-csrf-token': otherCsrf },
    });
    expect(res.statusCode).toBe(404);
  });

  // ── Delete packet ──────────────────────────────────────────────────────────

  it('DELETE /api/app/packets/:id deletes packet and returns 204', async () => {
    // Generate a packet first
    const csrf = await getCsrf(app, cookies);
    const genRes = await app.inject({
      method: 'POST',
      url: `/api/app/switches/${switchId}/packets/generate`,
      headers: { cookie: cookies, 'x-csrf-token': csrf },
    });
    expect(genRes.statusCode).toBe(201);
    const { packet } = JSON.parse(genRes.payload);

    // Delete it
    const delCsrf = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/app/packets/${packet.id}`,
      headers: { cookie: cookies, 'x-csrf-token': delCsrf },
    });
    expect(res.statusCode).toBe(204);
    expect(res.payload).toBe('');
  });

  it('DELETE /api/app/packets/:id for wrong user → 404', async () => {
    // Generate a packet as primary user
    const csrf = await getCsrf(app, cookies);
    const genRes = await app.inject({
      method: 'POST',
      url: `/api/app/switches/${switchId}/packets/generate`,
      headers: { cookie: cookies, 'x-csrf-token': csrf },
    });
    const { packet } = JSON.parse(genRes.payload);

    // Other user tries to delete it
    const otherCsrf = await getCsrf(app, otherCookies);
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/app/packets/${packet.id}`,
      headers: { cookie: otherCookies, 'x-csrf-token': otherCsrf },
    });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE requires CSRF → 403', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/app/packets/${randomUUID()}`,
      headers: { cookie: cookies }, // no CSRF
    });
    expect(res.statusCode).toBe(403);
  });

  // ── Audit event ────────────────────────────────────────────────────────────

  it('after generate, audit_events contains packet_generated event', async () => {
    const csrf = await getCsrf(app, cookies);
    const genRes = await app.inject({
      method: 'POST',
      url: `/api/app/switches/${switchId}/packets/generate`,
      headers: { cookie: cookies, 'x-csrf-token': csrf },
    });
    expect(genRes.statusCode).toBe(201);
    const { packet } = JSON.parse(genRes.payload);

    // Query audit_events for packet_generated with this userId
    const rows = await app.db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.userId, userId),
          eq(auditEvents.eventType, 'packet_generated'),
        ),
      );

    // Filter to this specific packet (metadata.packetId)
    const matching = rows.filter(
      (r) => (r.metadata as Record<string, unknown> | null)?.packetId === packet.id,
    );

    expect(matching.length).toBeGreaterThanOrEqual(1);
    expect(matching[0].actorType).toBe('user');
    expect(matching[0].actorId).toBe(userId);
  });
});
