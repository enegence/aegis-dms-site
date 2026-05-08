import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/index.js';

async function getCsrf(app: Awaited<ReturnType<typeof buildApp>>, cookies: string): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/api/csrf', headers: { cookie: cookies } });
  return JSON.parse(res.payload).csrfToken;
}

describe('Billing routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    // Register + login
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        displayName: 'Billing Test',
        email: 'billing@example.com',
        password: 'testpass12345',
        timezone: 'UTC',
      },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'billing@example.com', password: 'testpass12345' },
    });
    cookies = String(loginRes.headers['set-cookie']);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects checkout without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/checkout',
      payload: { plan: 'relay' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects checkout with invalid plan', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/checkout',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: { plan: 'invalid' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns subscription status for user with no subscription', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/billing/subscription',
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.subscription).toBeNull();
  });
});
