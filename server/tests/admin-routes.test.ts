/**
 * Tests for Admin API.
 *
 * Verifies:
 *  - Non-admin users denied (403)
 *  - Unauthenticated denied (401)
 *  - Admin role allowed
 *  - GET /api/admin/metrics returns counts
 *  - GET /api/admin/users returns redacted list (no passwordHash, no tokens)
 *  - GET /api/admin/users/:id returns redacted detail
 *  - GET /api/admin/relay-connections returns connection list (no apiKeyHash)
 *  - GET /api/admin/release-runs returns run list
 *  - GET /api/admin/packets returns packet metadata (no content)
 *  - GET /api/admin/notifications returns notification events
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/index.js';
import { users } from '../src/db/schema.js';

async function getCsrf(app: Awaited<ReturnType<typeof buildApp>>, cookies: string): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/api/csrf', headers: { cookie: cookies } });
  return JSON.parse(res.payload).csrfToken;
}

async function registerAndLogin(app: Awaited<ReturnType<typeof buildApp>>, suffix: string) {
  const email = `admin-test-${suffix}-${randomUUID()}@example.com`;
  await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { displayName: 'Admin Test', email, password: 'testpass12345', timezone: 'UTC' },
  });
  const loginRes = await app.inject({
    method: 'POST', url: '/api/auth/login',
    payload: { email, password: 'testpass12345' },
  });
  const cookies = String(loginRes.headers['set-cookie']);
  const meRes = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookies } });
  const userId = JSON.parse(meRes.payload).id as string;
  return { cookies, userId, email };
}

describe('Admin API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let adminCookies: string;
  let adminUserId: string;
  let regularCookies: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    // Regular user
    const regular = await registerAndLogin(app, 'regular');
    regularCookies = regular.cookies;

    // Admin user — register then promote via DB
    const admin = await registerAndLogin(app, 'admin');
    adminCookies = admin.cookies;
    adminUserId = admin.userId;
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUserId));
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Auth guards ───────────────────────────────────────────────────────────

  it('GET /api/admin/metrics returns 401 when unauthenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/metrics' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/metrics returns 403 for regular user', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/admin/metrics',
      headers: { cookie: regularCookies },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /api/admin/metrics returns 200 for admin', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/admin/metrics',
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(typeof body.totalUsers).toBe('number');
    expect(typeof body.verifiedUsers).toBe('number');
    expect(typeof body.activeSubscriptions).toBe('number');
    expect(typeof body.relayConnectionsActive).toBe('number');
    expect(typeof body.relayConnectionsOffline).toBe('number');
    expect(typeof body.activeReleaseRuns).toBe('number');
    expect(typeof body.packetsStored).toBe('number');
    expect(typeof body.notificationFailuresLast24h).toBe('number');
  });

  // ── Users ─────────────────────────────────────────────────────────────────

  it('GET /api/admin/users returns list without sensitive fields', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/admin/users',
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.users)).toBe(true);
    expect(body.users.length).toBeGreaterThan(0);

    const u = body.users[0];
    expect(u).not.toHaveProperty('passwordHash');
    expect(u).not.toHaveProperty('passwordResetTokenHash');
    expect(u).not.toHaveProperty('emailVerifyToken');
    expect(u).not.toHaveProperty('totpSecretEncrypted');
    expect(u).toHaveProperty('id');
    expect(u).toHaveProperty('email');
    expect(u).toHaveProperty('role');
  });

  it('GET /api/admin/users/:id returns redacted user detail', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/admin/users/${adminUserId}`,
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.user).toBeDefined();
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(body.user).not.toHaveProperty('passwordResetTokenHash');
    expect(body.user.id).toBe(adminUserId);
  });

  it('GET /api/admin/users/:id returns 404 for unknown user', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/admin/users/${randomUUID()}`,
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(404);
  });

  // ── Relay connections ─────────────────────────────────────────────────────

  it('GET /api/admin/relay-connections returns list without apiKeyHash', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/admin/relay-connections',
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.connections)).toBe(true);
    if (body.connections.length > 0) {
      expect(body.connections[0]).not.toHaveProperty('apiKeyHash');
    }
  });

  // ── Release runs ──────────────────────────────────────────────────────────

  it('GET /api/admin/release-runs returns list', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/admin/release-runs',
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.releaseRuns)).toBe(true);
  });

  // ── Packets ───────────────────────────────────────────────────────────────

  it('GET /api/admin/packets returns list without content', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/admin/packets',
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.packets)).toBe(true);
    if (body.packets.length > 0) {
      expect(body.packets[0]).not.toHaveProperty('encryptedContent');
      expect(body.packets[0]).not.toHaveProperty('storageKey');
    }
  });

  // ── Notifications ─────────────────────────────────────────────────────────

  it('GET /api/admin/notifications returns list', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/admin/notifications',
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.events)).toBe(true);
  });

  // ── sa role also admitted ─────────────────────────────────────────────────

  it('sa role also admitted to admin routes', async () => {
    const sa = await registerAndLogin(app, 'sa');
    await app.db.update(users).set({ role: 'sa' }).where(eq(users.id, sa.userId));
    // Re-login to get fresh session (role checked at request time)
    const loginRes = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: sa.email, password: 'testpass12345' },
    });
    const saCookies = String(loginRes.headers['set-cookie']);
    const res = await app.inject({
      method: 'GET', url: '/api/admin/metrics',
      headers: { cookie: saCookies },
    });
    expect(res.statusCode).toBe(200);
  });
});
