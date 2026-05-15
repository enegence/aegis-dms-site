/**
 * Phase 5 Task 6 — Admin hardening tests
 *
 * Verifies:
 *  - Non-admin gets 403 on GET /api/admin/users (not 404)
 *  - Non-admin gets 403 on GET /api/admin/users/:id (not 404)
 *  - Admin user detail does NOT contain encrypted PII fields from estate/contact sub-objects
 *  - Admin user list contains only allowed fields (no PII sub-objects)
 *  - Admin /api/admin/users/:id enriched response includes subscription/relay/release-run counts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/index.js';
import { users, subscriptions, relayConnections, releaseRuns, estateItems, contacts } from '../src/db/schema.js';

async function registerAndLogin(app: Awaited<ReturnType<typeof buildApp>>, suffix: string) {
  const email = `admin6-${suffix}-${randomUUID()}@example.com`;
  await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { displayName: 'Admin6 Test', email, password: 'testpass12345', timezone: 'UTC' },
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

describe('Admin API — Phase 5 Task 6 hardening', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let adminCookies: string;
  let adminUserId: string;
  let regularCookies: string;
  let targetUserId: string;

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

    // Target user — seed with subscription, relay connection, release run
    const target = await registerAndLogin(app, 'target');
    targetUserId = target.userId;

    // Seed subscription
    await app.db.insert(subscriptions).values({
      id: randomUUID(),
      userId: targetUserId,
      stripeCustomerId: 'cus_test_task6',
      stripeSubscriptionId: 'sub_test_task6',
      plan: 'relay',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed relay connection
    await app.db.insert(relayConnections).values({
      id: randomUUID(),
      userId: targetUserId,
      apiKeyHash: 'hash_for_test',
      label: 'Test relay',
      mode: 'relay_monitoring',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ── 403 for non-admins ───────────────────────────────────────────────────

  it('GET /api/admin/users returns 403 (not 404) for non-admin', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/admin/users',
      headers: { cookie: regularCookies },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /api/admin/users/:id returns 403 (not 404) for non-admin on existing user', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/admin/users/${targetUserId}`,
      headers: { cookie: regularCookies },
    });
    expect(res.statusCode).toBe(403);
  });

  // ── No encrypted PII in responses ───────────────────────────────────────

  it('Admin user list does not contain estate PII field names', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/admin/users',
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const rawPayload = res.payload;
    // These field names must never appear in the response
    expect(rawPayload).not.toContain('institutionName');
    expect(rawPayload).not.toContain('accountType');
    expect(rawPayload).not.toContain('referenceHint');
    expect(rawPayload).not.toContain('assetDescription');
    expect(rawPayload).not.toContain('locationNotes');
    expect(rawPayload).not.toContain('executorNotes');
    expect(rawPayload).not.toContain('institutionNameEncrypted');
  });

  it('Admin user list does not contain contact PII field names', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/admin/users',
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const rawPayload = res.payload;
    expect(rawPayload).not.toContain('fullName');
    expect(rawPayload).not.toContain('relationship');
    expect(rawPayload).not.toContain('telegramHandle');
    expect(rawPayload).not.toContain('backupNotes');
    expect(rawPayload).not.toContain('fullNameEncrypted');
    // phone can appear on the user row itself (as raw field) but not in decrypted form
    // The users table has phone field — it must NOT appear in admin user list
    // (it is excluded from the select in admin.ts)
  });

  it('Admin user detail does not contain estate or contact PII field names', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/admin/users/${targetUserId}`,
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const rawPayload = res.payload;
    expect(rawPayload).not.toContain('institutionName');
    expect(rawPayload).not.toContain('fullName');
    expect(rawPayload).not.toContain('telegramHandle');
    expect(rawPayload).not.toContain('backupNotes');
    expect(rawPayload).not.toContain('claimTokenHash');
    expect(rawPayload).not.toContain('packetKeyEncrypted');
  });

  // ── Admin user list contains only allowed top-level fields ───────────────

  it('Admin user list contains allowed fields only (no phone, no password fields)', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/admin/users',
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.users)).toBe(true);
    expect(body.users.length).toBeGreaterThan(0);

    const u = body.users[0];
    // Required allowed fields
    expect(u).toHaveProperty('id');
    expect(u).toHaveProperty('email');
    expect(u).toHaveProperty('displayName');
    expect(u).toHaveProperty('emailVerified');
    expect(u).toHaveProperty('createdAt');
    // Must NOT have sensitive fields
    expect(u).not.toHaveProperty('passwordHash');
    expect(u).not.toHaveProperty('phone');
    expect(u).not.toHaveProperty('totpSecretEncrypted');
    expect(u).not.toHaveProperty('passwordResetTokenHash');
    expect(u).not.toHaveProperty('emailVerifyToken');
    expect(u).not.toHaveProperty('deletionTokenHash');
  });

  // ── Admin user detail includes aggregated counts ─────────────────────────

  it('Admin user detail includes subscription status', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/admin/users/${targetUserId}`,
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.user).toHaveProperty('id', targetUserId);
    expect(body.user).toHaveProperty('email');
    expect(body.user).toHaveProperty('emailVerified');
    expect(body.user).toHaveProperty('createdAt');
    // Subscription summary
    expect(body.user).toHaveProperty('subscriptionStatus');
    expect(body.user).toHaveProperty('subscriptionPlan');
    // Aggregated counts
    expect(body.user).toHaveProperty('relayConnectionCount');
    expect(typeof body.user.relayConnectionCount).toBe('number');
    expect(body.user.relayConnectionCount).toBeGreaterThan(0);
    expect(body.user).toHaveProperty('activeReleaseRunCount');
    expect(typeof body.user.activeReleaseRunCount).toBe('number');
    expect(body.user).toHaveProperty('failedNotificationCount');
    expect(typeof body.user.failedNotificationCount).toBe('number');
    // lastLoginAt — nullable, may be null on fresh user but property must exist
    expect(body.user).toHaveProperty('lastLoginAt');
    // hostedSwitchCount
    expect(body.user).toHaveProperty('hostedSwitchCount');
    expect(typeof body.user.hostedSwitchCount).toBe('number');
  });

  it('Admin user detail does NOT include Stripe IDs', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/admin/users/${targetUserId}`,
      headers: { cookie: adminCookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    // Stripe internal IDs are not admin-visible at the user level
    expect(body.user).not.toHaveProperty('stripeCustomerId');
    expect(body.user).not.toHaveProperty('stripeSubscriptionId');
  });
});
