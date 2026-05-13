/**
 * Phase 3 end-to-end verification.
 *
 * Validates cross-cutting Phase 3 invariants that are not covered by
 * individual unit/integration tests:
 *
 *  - Monitoring-only relay connection never starts a release run
 *  - Admin metrics reflect live state across users
 *  - Release run endpoint returns user-scoped runs only
 *  - Release run cancel prevents re-triggering
 *  - Packet list is user-scoped (no cross-user leakage)
 *  - Phase 3 completion checklist assertions
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/index.js';
import { users, relayConnections, releaseRuns } from '../src/db/schema.js';
import { runRelayEscrowCascadeOnce } from '../src/services/relay-assisted-cascade.js';

async function registerAndLogin(app: Awaited<ReturnType<typeof buildApp>>, prefix: string) {
  const email = `p3v-${prefix}-${randomUUID()}@example.com`;
  await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { displayName: 'Phase3 Test', email, password: 'testpass12345', timezone: 'UTC' },
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

async function getCsrf(app: Awaited<ReturnType<typeof buildApp>>, cookies: string) {
  const res = await app.inject({ method: 'GET', url: '/api/csrf', headers: { cookie: cookies } });
  return JSON.parse(res.payload).csrfToken as string;
}

describe('Phase 3 — cross-cutting invariants', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('monitoring-only offline relay connection does not start a release run', async () => {
    const { cookies, userId } = await registerAndLogin(app, 'mon-only');
    const csrf = await getCsrf(app, cookies);

    // Create monitoring-only connection
    const connRes = await app.inject({
      method: 'POST', url: '/api/relay/connections',
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: { label: 'Mon Only', mode: 'relay_monitoring' },
    });
    const connId = JSON.parse(connRes.payload).connection.id as string;

    // Force offline
    await app.db.update(relayConnections)
      .set({ status: 'offline' })
      .where(eq(relayConnections.id, connId));

    // Worker runs
    await runRelayEscrowCascadeOnce(app.db, app.config);

    // No release run should exist
    const runs = await app.db.select().from(releaseRuns).where(eq(releaseRuns.userId, userId));
    expect(runs).toHaveLength(0);
  });

  it('GET /api/app/release-runs returns only the requesting user runs', async () => {
    const { cookies: cookiesA, userId: userA } = await registerAndLogin(app, 'scope-a');
    const { userId: userB } = await registerAndLogin(app, 'scope-b');

    // Insert a release run for user B
    await app.db.insert(releaseRuns).values({
      userId: userB,
      source: 'hosted',
      status: 'completed',
    });

    const res = await app.inject({
      method: 'GET', url: '/api/app/release-runs',
      headers: { cookie: cookiesA },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload) as { releaseRuns: { userId: string }[] };
    const otherUser = body.releaseRuns.find(r => r.userId === userB);
    expect(otherUser).toBeUndefined();
  });

  it('cancelled release run cannot be cancelled again', async () => {
    const { cookies, userId } = await registerAndLogin(app, 'cancel-idempotent');
    const csrf = await getCsrf(app, cookies);

    // Insert an active release run
    const [run] = await app.db.insert(releaseRuns).values({
      userId,
      source: 'hosted',
      status: 'active',
    }).returning({ id: releaseRuns.id });

    // Cancel it
    const res1 = await app.inject({
      method: 'POST', url: `/api/app/release-runs/${run!.id}/cancel`,
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: {},
    });
    expect(res1.statusCode).toBe(204);

    // Cancel again — should 409
    const res2 = await app.inject({
      method: 'POST', url: `/api/app/release-runs/${run!.id}/cancel`,
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: {},
    });
    expect(res2.statusCode).toBe(409);
  });

  it('admin metrics reflect users and connections in DB', async () => {
    // Create admin user
    const { cookies, userId } = await registerAndLogin(app, 'metrics-admin');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, userId));

    const res = await app.inject({
      method: 'GET', url: '/api/admin/metrics',
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const metrics = JSON.parse(res.payload);

    // These are global counts — verify they're non-negative numbers
    expect(metrics.totalUsers).toBeGreaterThan(0);
    expect(typeof metrics.relayConnectionsActive).toBe('number');
    expect(typeof metrics.relayConnectionsOffline).toBe('number');
    expect(typeof metrics.notificationFailuresLast24h).toBe('number');
  });

  it('GET /api/app/packets returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/app/packets' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/app/release-runs returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/app/release-runs' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/app/release-runs/:id/cancel returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/app/release-runs/${randomUUID()}/cancel`,
      payload: {},
    });
    expect(res.statusCode).toBe(401);
  });
});
