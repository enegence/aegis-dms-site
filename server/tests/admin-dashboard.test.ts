/**
 * Tests for Admin Dashboard endpoints (Task 7).
 *
 * Verifies:
 *  - Non-admin rejected (403), unauthenticated rejected (401)
 *  - AEGIS_ADMIN_EMAILS env-based admin bypass
 *  - GET /api/admin/subscriptions returns plan/status — no Stripe secrets
 *  - GET /api/admin/system-health returns status/uptime/dbConnected
 *  - GET /api/admin/users does NOT return phone, passwordHash
 *  - GET /api/admin/relay-connections does NOT return apiKeyHash
 *  - Sensitive fields (apiKey, passwordHash, packet content) absent from all endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/index.js';
import { users, subscriptions } from '../src/db/schema.js';

async function registerAndLogin(app: Awaited<ReturnType<typeof buildApp>>, suffix: string) {
  const email = `admin-dash-${suffix}-${randomUUID()}@example.com`;
  await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { displayName: 'Admin Dash Test', email, password: 'testpass12345', timezone: 'UTC' },
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

describe('Admin Dashboard endpoints', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let adminCookies: string;
  let adminUserId: string;
  let regularCookies: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    // Regular user
    const regular = await registerAndLogin(app, 'regular');
    regularCookies = regular.cookies;

    // Admin user — promote via DB
    const admin = await registerAndLogin(app, 'admin');
    adminCookies = admin.cookies;
    adminUserId = admin.userId;
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUserId));

    // Seed a subscription for admin user
    await app.db.insert(subscriptions).values({
      id: randomUUID(),
      userId: adminUserId,
      stripeCustomerId: 'cus_test_redacted',
      stripeSubscriptionId: 'sub_test_redacted',
      plan: 'relay',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Auth guards ───────────────────────────────────────────────────────────

  it('GET /api/admin/subscriptions returns 401 when unauthenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/subscriptions' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/subscriptions returns 403 for regular user', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/admin/subscriptions',
      headers: { cookie: regularCookies },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /api/admin/system-health returns 401 when unauthenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/system-health' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/system-health returns 403 for regular user', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/admin/system-health',
      headers: { cookie: regularCookies },
    });
    expect(res.statusCode).toBe(403);
  });

  // ── AEGIS_ADMIN_EMAILS env-based bypass ───────────────────────────────────

  it('user in AEGIS_ADMIN_EMAILS can access admin endpoints without role promotion', async () => {
    // Create a new user with regular role but whose email is in adminEmails
    const emailUser = await registerAndLogin(app, 'email-admin');

    // Build app instance with adminEmails override
    const appWithEmailAdmin = await buildApp({
      testing: true,
      adminEmails: [emailUser.email.toLowerCase()],
    });

    // Re-login in the new app instance
    const loginRes = await appWithEmailAdmin.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: emailUser.email, password: 'testpass12345' },
    });
    const cookies = String(loginRes.headers['set-cookie']);

    // Register the user in the new app (they may not exist in this DB, but since testing: true
    // uses the same DB we can just re-use loginRes)
    const res = await appWithEmailAdmin.inject({
      method: 'GET', url: '/api/admin/metrics',
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);

    await appWithEmailAdmin.close();
  });

  it('user NOT in AEGIS_ADMIN_EMAILS is still denied if role is user', async () => {
    const appWithEmailAdmin = await buildApp({
      testing: true,
      adminEmails: ['other-person@example.com'],
    });

    const loginRes = await appWithEmailAdmin.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: `admin-dash-regular-${(regularCookies.slice(0, 8))}@example.com`, password: 'testpass12345' },
    });
    // Should be 401 (user doesn't exist in fresh app)
    // Instead test via freshly registered regular user
    const fresh = await registerAndLogin(appWithEmailAdmin, 'not-in-list');
    const res = await appWithEmailAdmin.inject({
      method: 'GET', url: '/api/admin/metrics',
      headers: { cookie: fresh.cookies },
    });
    expect(res.statusCode).toBe(403);

    await appWithEmailAdmin.close();
  });

  // ── GET /api/admin/subscriptions ──────────────────────────────────────────

  it('returns subscriptions list with plan/status/email', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/admin/subscriptions',
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.subscriptions)).toBe(true);
    expect(body.subscriptions.length).toBeGreaterThan(0);

    const sub = body.subscriptions[0];
    expect(sub).toHaveProperty('userId');
    expect(sub).toHaveProperty('email');
    expect(sub).toHaveProperty('plan');
    expect(sub).toHaveProperty('status');
    expect(sub).toHaveProperty('createdAt');
  });

  it('subscriptions endpoint does NOT return Stripe secrets', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/admin/subscriptions',
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    const sub = body.subscriptions[0];
    expect(sub).not.toHaveProperty('stripeCustomerId');
    expect(sub).not.toHaveProperty('stripeSubscriptionId');
  });

  // ── GET /api/admin/system-health ──────────────────────────────────────────

  it('returns system health with status/dbConnected/uptime', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/admin/system-health',
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
    expect(body.dbConnected).toBe(true);
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(typeof body.timestamp).toBe('string');
  });

  // ── Redaction checks on existing endpoints ────────────────────────────────

  it('GET /api/admin/users does NOT return phone or passwordHash', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/admin/users',
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.users)).toBe(true);
    expect(body.users.length).toBeGreaterThan(0);

    const u = body.users[0];
    expect(u).not.toHaveProperty('phone');
    expect(u).not.toHaveProperty('passwordHash');
    expect(u).not.toHaveProperty('passwordResetTokenHash');
    expect(u).not.toHaveProperty('emailVerifyToken');
    expect(u).not.toHaveProperty('totpSecretEncrypted');
  });

  it('GET /api/admin/users/:id does NOT return phone or passwordHash', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/admin/users/${adminUserId}`,
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.user).not.toHaveProperty('phone');
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(body.user).not.toHaveProperty('totpSecretEncrypted');
  });

  it('GET /api/admin/relay-connections does NOT return apiKeyHash', async () => {
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

  it('GET /api/admin/packets does NOT return encryptedContent or storageObjectKey', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/admin/packets',
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.packets)).toBe(true);
    if (body.packets.length > 0) {
      expect(body.packets[0]).not.toHaveProperty('encryptedContent');
      expect(body.packets[0]).not.toHaveProperty('storageObjectKey');
      expect(body.packets[0]).not.toHaveProperty('packetKeyEncrypted');
    }
  });
});
