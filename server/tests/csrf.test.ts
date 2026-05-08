import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/index.js';

describe('CSRF protection', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { email: 'csrf@test.com', displayName: 'CSRF Test', password: 'testpass123' },
    });
    const loginRes = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'csrf@test.com', password: 'testpass123' },
    });
    cookies = String(loginRes.headers['set-cookie']);
  });

  afterAll(async () => { await app.close(); });

  it('GET /api/csrf returns a CSRF token', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/csrf',
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.csrfToken).toBeDefined();
    expect(typeof body.csrfToken).toBe('string');
  });

  it('rejects POST without CSRF token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/estate-items',
      headers: { cookie: cookies },
      payload: { category: 'Financial', title: 'Test Item' },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('CSRF');
  });

  it('rejects POST with invalid CSRF token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/estate-items',
      headers: { cookie: cookies, 'x-csrf-token': 'invalid-token' },
      payload: { category: 'Financial', title: 'Test Item' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('accepts POST with valid CSRF token', async () => {
    const csrfRes = await app.inject({
      method: 'GET', url: '/api/csrf',
      headers: { cookie: cookies },
    });
    const { csrfToken } = JSON.parse(csrfRes.payload);

    const res = await app.inject({
      method: 'POST', url: '/api/estate-items',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: { category: 'Financial', title: 'Test Item' },
    });
    expect([200, 201]).toContain(res.statusCode);
  });

  it('rejects CSRF token from another session', async () => {
    const csrfRes = await app.inject({
      method: 'GET', url: '/api/csrf',
      headers: { cookie: cookies },
    });
    const { csrfToken } = JSON.parse(csrfRes.payload);

    await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { email: 'other@test.com', displayName: 'Other', password: 'testpass123' },
    });
    const otherLogin = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'other@test.com', password: 'testpass123' },
    });
    const otherCookies = String(otherLogin.headers['set-cookie']);

    const res = await app.inject({
      method: 'POST', url: '/api/estate-items',
      headers: { cookie: otherCookies, 'x-csrf-token': csrfToken },
      payload: { category: 'Financial', title: 'Test Item' },
    });
    expect(res.statusCode).toBe(403);
  });
});
