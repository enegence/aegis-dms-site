import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/index.js';
import { users } from '../src/db/schema.js';

const FAKE_UUID_1 = '00000000-0000-0000-0000-000000000001';
const FAKE_UUID_2 = '00000000-0000-0000-0000-000000000002';

// Future date for trip mode
const FUTURE_DATE = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

async function getCsrf(app: Awaited<ReturnType<typeof buildApp>>, cookies: string): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/api/csrf', headers: { cookie: cookies } });
  return JSON.parse(res.payload).csrfToken;
}

describe('Switch API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;
  let otherCookies: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    // Register and login primary user
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        displayName: 'Switch Tester',
        email: 'switches@example.com',
        password: 'testpass12345',
        timezone: 'UTC',
      },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'switches@example.com', password: 'testpass12345' },
    });
    cookies = String(loginRes.headers['set-cookie']);

    // Set emailVerified = true so readiness checks pass
    await app.db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.email, 'switches@example.com'));

    // Register and login second user for isolation tests
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        displayName: 'Switch Other',
        email: 'switches-other@example.com',
        password: 'testpass12345',
        timezone: 'UTC',
      },
    });
    const otherLoginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'switches-other@example.com', password: 'testpass12345' },
    });
    otherCookies = String(otherLoginRes.headers['set-cookie']);
  });

  afterAll(async () => {
    await app.close();
  });

  // 1. GET /api/switches returns empty array for new user
  it('GET /api/switches returns empty array for new user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/switches',
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.switches)).toBe(true);
    expect(body.switches).toHaveLength(0);
  });

  // 2. POST creates trip switch
  it('POST /api/switches creates trip switch → 201 with mode=trip, status=draft', async () => {
    const csrf = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: '/api/switches',
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: {
        name: 'My Trip Switch',
        mode: 'trip',
        triggerAt: FUTURE_DATE,
        gracePeriodHours: 72,
        warningWindowDays: 3,
        selectedContactIds: [],
        selectedEstateItemIds: [],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.switch.id).toBeDefined();
    expect(body.switch.mode).toBe('trip');
    expect(body.switch.status).toBe('draft');
    expect(body.switch.name).toBe('My Trip Switch');
  });

  // 3. POST creates heartbeat switch
  it('POST /api/switches creates heartbeat switch → 201 with mode=heartbeat, status=draft', async () => {
    const csrf = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: '/api/switches',
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: {
        name: 'My Heartbeat Switch',
        mode: 'heartbeat',
        heartbeatIntervalDays: 7,
        gracePeriodHours: 24,
        warningWindowDays: 2,
        selectedContactIds: [],
        selectedEstateItemIds: [],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.switch.id).toBeDefined();
    expect(body.switch.mode).toBe('heartbeat');
    expect(body.switch.status).toBe('draft');
    expect(body.switch.name).toBe('My Heartbeat Switch');
  });

  // 4. GET /api/switches/:id returns switch
  it('GET /api/switches/:id returns the switch', async () => {
    // Create one first
    const csrf = await getCsrf(app, cookies);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/switches',
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: {
        name: 'Fetch Me Switch',
        mode: 'trip',
        triggerAt: FUTURE_DATE,
        gracePeriodHours: 72,
        warningWindowDays: 3,
        selectedContactIds: [],
        selectedEstateItemIds: [],
      },
    });
    const { switch: created } = JSON.parse(createRes.payload);

    const res = await app.inject({
      method: 'GET',
      url: `/api/switches/${created.id}`,
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.switch.id).toBe(created.id);
    expect(body.switch.name).toBe('Fetch Me Switch');
  });

  // 5. PUT updates switch name; mode unchanged
  it('PUT /api/switches/:id updates name, mode stays unchanged', async () => {
    const csrf = await getCsrf(app, cookies);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/switches',
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: {
        name: 'Before Update',
        mode: 'trip',
        triggerAt: FUTURE_DATE,
        gracePeriodHours: 72,
        warningWindowDays: 3,
        selectedContactIds: [],
        selectedEstateItemIds: [],
      },
    });
    const { switch: created } = JSON.parse(createRes.payload);

    const putCsrf = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'PUT',
      url: `/api/switches/${created.id}`,
      headers: { cookie: cookies, 'x-csrf-token': putCsrf },
      payload: { name: 'After Update' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.switch.name).toBe('After Update');
    expect(body.switch.mode).toBe('trip'); // mode unchanged
  });

  // 6. DELETE draft switch → 200 { ok: true }
  it('DELETE draft switch returns 200 { ok: true }', async () => {
    const csrf = await getCsrf(app, cookies);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/switches',
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: {
        name: 'Delete Me Switch',
        mode: 'trip',
        triggerAt: FUTURE_DATE,
        gracePeriodHours: 72,
        warningWindowDays: 3,
        selectedContactIds: [],
        selectedEstateItemIds: [],
      },
    });
    const { switch: created } = JSON.parse(createRes.payload);

    const delCsrf = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/switches/${created.id}`,
      headers: { cookie: cookies, 'x-csrf-token': delCsrf },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).ok).toBe(true);
  });

  // 7. DELETE armed switch fails → 409
  it('DELETE armed switch returns 409', async () => {
    // Create an arm-ready switch
    const csrf = await getCsrf(app, cookies);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/switches',
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: {
        name: 'Armed Switch to Delete',
        mode: 'trip',
        triggerAt: FUTURE_DATE,
        gracePeriodHours: 72,
        warningWindowDays: 3,
        selectedContactIds: [FAKE_UUID_1],
        selectedEstateItemIds: [FAKE_UUID_2],
      },
    });
    const { switch: created } = JSON.parse(createRes.payload);

    // Arm it
    const armCsrf = await getCsrf(app, cookies);
    const armRes = await app.inject({
      method: 'POST',
      url: `/api/switches/${created.id}/arm`,
      headers: { cookie: cookies, 'x-csrf-token': armCsrf },
      payload: {},
    });
    expect(armRes.statusCode).toBe(200);
    expect(JSON.parse(armRes.payload).switch.status).toBe('armed');

    // Now try to delete it → 409
    const delCsrf = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/switches/${created.id}`,
      headers: { cookie: cookies, 'x-csrf-token': delCsrf },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.payload).error).toBe('Cannot delete active switch');
  });

  // 8. GET /api/switches/:id/readiness before setup → ready=false
  it('GET /api/switches/:id/readiness before contacts/items → ready=false', async () => {
    const csrf = await getCsrf(app, cookies);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/switches',
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: {
        name: 'Readiness Check Switch',
        mode: 'trip',
        triggerAt: FUTURE_DATE,
        gracePeriodHours: 72,
        warningWindowDays: 3,
        selectedContactIds: [],
        selectedEstateItemIds: [],
      },
    });
    const { switch: created } = JSON.parse(createRes.payload);

    const res = await app.inject({
      method: 'GET',
      url: `/api/switches/${created.id}/readiness`,
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.ready).toBe(false);
    expect(Array.isArray(body.checks)).toBe(true);
  });

  // 9. POST arm fails when not ready → 422
  it('POST /api/switches/:id/arm fails when not ready → 422', async () => {
    const csrf = await getCsrf(app, cookies);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/switches',
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: {
        name: 'Not Ready Switch',
        mode: 'trip',
        triggerAt: FUTURE_DATE,
        gracePeriodHours: 72,
        warningWindowDays: 3,
        selectedContactIds: [],     // no contacts → not ready
        selectedEstateItemIds: [],
      },
    });
    const { switch: created } = JSON.parse(createRes.payload);

    const armCsrf = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: `/api/switches/${created.id}/arm`,
      headers: { cookie: cookies, 'x-csrf-token': armCsrf },
      payload: {},
    });
    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Switch not ready to arm');
    expect(Array.isArray(body.checks)).toBe(true);
  });

  // 10. POST arm succeeds when ready → status=armed
  it('POST /api/switches/:id/arm succeeds when ready → status=armed', async () => {
    const csrf = await getCsrf(app, cookies);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/switches',
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: {
        name: 'Ready Trip Switch',
        mode: 'trip',
        triggerAt: FUTURE_DATE,
        gracePeriodHours: 72,
        warningWindowDays: 3,
        selectedContactIds: [FAKE_UUID_1],
        selectedEstateItemIds: [FAKE_UUID_2],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { switch: created } = JSON.parse(createRes.payload);

    const armCsrf = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: `/api/switches/${created.id}/arm`,
      headers: { cookie: cookies, 'x-csrf-token': armCsrf },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.switch.status).toBe('armed');
  });

  // 11. POST pause → status=paused
  it('POST /api/switches/:id/pause → status=paused', async () => {
    // Create and arm a switch first
    const csrf = await getCsrf(app, cookies);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/switches',
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: {
        name: 'Pause Me Switch',
        mode: 'trip',
        triggerAt: FUTURE_DATE,
        gracePeriodHours: 72,
        warningWindowDays: 3,
        selectedContactIds: [FAKE_UUID_1],
        selectedEstateItemIds: [FAKE_UUID_2],
      },
    });
    const { switch: created } = JSON.parse(createRes.payload);

    const armCsrf = await getCsrf(app, cookies);
    await app.inject({
      method: 'POST',
      url: `/api/switches/${created.id}/arm`,
      headers: { cookie: cookies, 'x-csrf-token': armCsrf },
      payload: {},
    });

    const pauseCsrf = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: `/api/switches/${created.id}/pause`,
      headers: { cookie: cookies, 'x-csrf-token': pauseCsrf },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.switch.status).toBe('paused');
  });

  // 12. POST cancel → status=cancelled
  it('POST /api/switches/:id/cancel → status=cancelled', async () => {
    const csrf = await getCsrf(app, cookies);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/switches',
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: {
        name: 'Cancel Me Switch',
        mode: 'trip',
        triggerAt: FUTURE_DATE,
        gracePeriodHours: 72,
        warningWindowDays: 3,
        selectedContactIds: [FAKE_UUID_1],
        selectedEstateItemIds: [FAKE_UUID_2],
      },
    });
    const { switch: created } = JSON.parse(createRes.payload);

    const armCsrf = await getCsrf(app, cookies);
    await app.inject({
      method: 'POST',
      url: `/api/switches/${created.id}/arm`,
      headers: { cookie: cookies, 'x-csrf-token': armCsrf },
      payload: {},
    });

    const cancelCsrf = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: `/api/switches/${created.id}/cancel`,
      headers: { cookie: cookies, 'x-csrf-token': cancelCsrf },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.switch.status).toBe('cancelled');
  });

  // 13. Heartbeat check-in: arm heartbeat → check-in → lastCheckInAt updated
  it('POST /api/switches/:id/check-in updates lastCheckInAt', async () => {
    const csrf = await getCsrf(app, cookies);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/switches',
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: {
        name: 'Heartbeat Check-in Switch',
        mode: 'heartbeat',
        heartbeatIntervalDays: 1,
        gracePeriodHours: 24,
        warningWindowDays: 0,
        selectedContactIds: [FAKE_UUID_1],
        selectedEstateItemIds: [FAKE_UUID_2],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { switch: created } = JSON.parse(createRes.payload);

    // Arm it
    const armCsrf = await getCsrf(app, cookies);
    const armRes = await app.inject({
      method: 'POST',
      url: `/api/switches/${created.id}/arm`,
      headers: { cookie: cookies, 'x-csrf-token': armCsrf },
      payload: {},
    });
    expect(armRes.statusCode).toBe(200);
    expect(JSON.parse(armRes.payload).switch.status).toBe('armed');

    // Check in
    const checkInCsrf = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: `/api/switches/${created.id}/check-in`,
      headers: { cookie: cookies, 'x-csrf-token': checkInCsrf },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.switch.status).toBe('armed');
    expect(body.switch.lastCheckInAt).not.toBeNull();
  });

  // 14. Cross-user isolation: user B cannot GET user A's switch
  it('cross-user isolation: user B cannot access user A switch → 404', async () => {
    const csrf = await getCsrf(app, cookies);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/switches',
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: {
        name: 'User A Private Switch',
        mode: 'trip',
        triggerAt: FUTURE_DATE,
        gracePeriodHours: 72,
        warningWindowDays: 3,
        selectedContactIds: [],
        selectedEstateItemIds: [],
      },
    });
    const { switch: created } = JSON.parse(createRes.payload);

    // User B tries to access
    const res = await app.inject({
      method: 'GET',
      url: `/api/switches/${created.id}`,
      headers: { cookie: otherCookies },
    });
    expect(res.statusCode).toBe(404);
  });

  // 15. POST requires CSRF → 403
  it('POST /api/switches requires CSRF token → 403 without it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/switches',
      headers: { cookie: cookies }, // no x-csrf-token
      payload: {
        name: 'No CSRF Switch',
        mode: 'trip',
        triggerAt: FUTURE_DATE,
        gracePeriodHours: 72,
        warningWindowDays: 3,
        selectedContactIds: [],
        selectedEstateItemIds: [],
      },
    });
    expect(res.statusCode).toBe(403);
  });
});
