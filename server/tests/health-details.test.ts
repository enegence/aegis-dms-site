/**
 * Tests for health endpoints (Phase 5 Task 5).
 *
 * Verifies:
 *  - GET /health returns minimal fields only (status, version) — no DB state
 *  - GET /api/health/details requires auth (401 without session)
 *  - GET /api/health/details returns worker/storage/notification state (admin-only)
 *  - GET /api/health/details does not include user PII or secrets
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/index.js';
import { users } from '../src/db/schema.js';

async function registerAndLogin(app: Awaited<ReturnType<typeof buildApp>>, suffix: string) {
  const email = `healthtest-${suffix}-${randomUUID()}@example.com`;
  await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { displayName: 'Health Test', email, password: 'testpassword12345', timezone: 'UTC' },
  });
  const loginRes = await app.inject({
    method: 'POST', url: '/api/auth/login',
    payload: { email, password: 'testpassword12345' },
  });
  const cookies = String(loginRes.headers['set-cookie']);
  const meRes = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookies } });
  const userId = JSON.parse(meRes.payload).id as string;
  return { cookies, userId, email };
}

describe('health endpoints', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let regularCookies: string;
  let adminCookies: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    const regular = await registerAndLogin(app, 'regular');
    regularCookies = regular.cookies;

    const admin = await registerAndLogin(app, 'admin');
    adminCookies = admin.cookies;
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, admin.userId));
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 with minimal fields only', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
    expect(body.version).toBeDefined();
    // Must NOT expose database state, worker status, etc. in public health
    expect(body.database).toBeUndefined();
    expect(body.worker).toBeUndefined();
    expect(body.storage).toBeUndefined();
    expect(body.alerts).toBeUndefined();
  });

  it('GET /api/health/details returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health/details' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/health/details returns 403 for regular user', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/health/details',
      headers: { cookie: regularCookies },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /api/health/details returns 200 for admin with health state', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/health/details',
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    // Database status
    expect(body.database).toBeDefined();
    expect(body.database.status).toBe('ok');

    // Worker status
    expect(body.worker).toBeDefined();
    expect(['ok', 'degraded', 'unknown']).toContain(body.worker.status);

    // Storage status
    expect(body.storage).toBeDefined();
    expect(['ok', 'error', 'unconfigured']).toContain(body.storage.status);

    // Notification counts
    expect(body.notifications).toBeDefined();
    expect(typeof body.notifications.failedCount).toBe('number');
    expect(typeof body.notifications.retryableCount).toBe('number');

    // Operational counts
    expect(typeof body.activeReleaseRuns).toBe('number');
    expect(typeof body.pendingClaims).toBe('number');

    // Alerts array
    expect(Array.isArray(body.alerts)).toBe(true);
  });

  it('GET /api/health/details does not include PII or secrets', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/health/details',
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const rawPayload = res.payload;

    // No sensitive fields in response
    expect(rawPayload).not.toContain('passwordHash');
    expect(rawPayload).not.toContain('secretKey');
    expect(rawPayload).not.toContain('totpSecret');
    expect(rawPayload).not.toContain('encrypted');
  });
});
