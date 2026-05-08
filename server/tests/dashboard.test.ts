import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/index.js';
import { users, switches } from '../src/db/schema.js';

async function getCsrf(app: Awaited<ReturnType<typeof buildApp>>, cookies: string): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/api/csrf', headers: { cookie: cookies } });
  return JSON.parse(res.payload).csrfToken;
}

async function registerAndLogin(
  app: Awaited<ReturnType<typeof buildApp>>,
  email: string,
  displayName: string,
): Promise<string> {
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { displayName, email, password: 'testpass12345', timezone: 'UTC' },
  });
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: 'testpass12345' },
  });
  return String(loginRes.headers['set-cookie']);
}

describe('Dashboard API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    cookies = await registerAndLogin(app, 'dashboard@example.com', 'Dashboard User');
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/dashboard returns empty state for a new user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.user.displayName).toBe('Dashboard User');
    expect(body.user.emailVerified).toBe(false);
    expect(body.subscription.plan).toBeNull();
    expect(body.subscription.status).toBeNull();
    expect(body.estateItemCount).toBe(0);
    expect(body.contactCount).toBe(0);
    expect(body.activeSwitchCount).toBe(0);
    expect(body.warningSwitchCount).toBe(0);
    expect(body.triggeredSwitchCount).toBe(0);
    expect(body.relayConnectionCount).toBe(0);
    expect(body.offlineRelayConnectionCount).toBe(0);
    expect(body.nextSwitch).toBeNull();
    expect(body.nextActionAt).toBeNull();
  });

  it('GET /api/dashboard returns correct counts after adding estate items and contacts', async () => {
    const csrfToken = await getCsrf(app, cookies);

    // Create 2 estate items
    await app.inject({
      method: 'POST',
      url: '/api/estate-items',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: { category: 'financial', title: 'Savings Account' },
    });
    const csrf2 = await getCsrf(app, cookies);
    await app.inject({
      method: 'POST',
      url: '/api/estate-items',
      headers: { cookie: cookies, 'x-csrf-token': csrf2 },
      payload: { category: 'property', title: 'House Deed' },
    });

    // Create 1 contact
    const csrf3 = await getCsrf(app, cookies);
    await app.inject({
      method: 'POST',
      url: '/api/contacts',
      headers: { cookie: cookies, 'x-csrf-token': csrf3 },
      payload: {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        priorityOrder: 1,
        preferredChannels: ['email'],
        confirmationWindowHours: 48,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.estateItemCount).toBe(2);
    expect(body.contactCount).toBe(1);
  });

  it('GET /api/dashboard shows activeSwitchCount=1 when an armed trip switch exists', async () => {
    // Get userId to set emailVerified
    const [u] = await app.db.select({ id: users.id }).from(users).where(eq(users.email, 'dashboard@example.com'));
    await app.db.update(users).set({ emailVerified: true }).where(eq(users.id, u!.id));

    const FUTURE_DATE = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const FAKE_UUID_1 = '00000000-0000-0000-0000-000000000001';
    const FAKE_UUID_2 = '00000000-0000-0000-0000-000000000002';

    // Create trip switch
    const csrfToken = await getCsrf(app, cookies);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/switches',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: {
        name: 'Dashboard Trip Switch',
        mode: 'trip',
        triggerAt: FUTURE_DATE,
        gracePeriodHours: 72,
        warningWindowDays: 3,
        selectedContactIds: [FAKE_UUID_1],
        selectedEstateItemIds: [FAKE_UUID_2],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { switch: sw } = JSON.parse(createRes.payload);

    // Arm it directly in DB
    await app.db.update(switches).set({ status: 'armed' }).where(eq(switches.id, sw.id));

    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.activeSwitchCount).toBe(1);
    expect(body.nextSwitch).not.toBeNull();
    expect(body.nextSwitch!.id).toBe(sw.id);
    expect(body.nextActionAt).not.toBeNull();
  });

  it('GET /api/dashboard requires auth (401 without cookie)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard',
    });
    expect(res.statusCode).toBe(401);
  });

  it('cross-user isolation: user A data does not appear in user B dashboard', async () => {
    // User B: fresh account with no data
    const otherCookies = await registerAndLogin(app, 'dashboard-other@example.com', 'Other Dashboard User');

    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: { cookie: otherCookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    // User A created estate items, contacts, and switches — none should appear for user B
    expect(body.estateItemCount).toBe(0);
    expect(body.contactCount).toBe(0);
    expect(body.activeSwitchCount).toBe(0);
    expect(body.nextSwitch).toBeNull();
  });
});
