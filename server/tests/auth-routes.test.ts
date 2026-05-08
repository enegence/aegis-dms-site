import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/index.js';

describe('Auth routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('creates a new user account', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          displayName: 'Test User',
          email: 'test@example.com',
          password: 'secure-passphrase-123',
          timezone: 'America/Chicago',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.user.displayName).toBe('Test User');
      expect(body.user.email).toBe('test@example.com');
      expect(body.user.emailVerified).toBe(false);
    });

    it('rejects duplicate email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          displayName: 'Another User',
          email: 'test@example.com',
          password: 'another-password-123',
          timezone: 'UTC',
        },
      });
      expect(res.statusCode).toBe(409);
    });

    it('rejects weak password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          displayName: 'Weak User',
          email: 'weak@example.com',
          password: 'short',
          timezone: 'UTC',
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns session cookie on valid login', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'secure-passphrase-123',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['set-cookie']).toBeDefined();
      const cookies = String(res.headers['set-cookie']);
      expect(cookies).toContain('aegis_session');
    });

    it('rejects invalid password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'wrong-password',
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects non-existent email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'nobody@example.com',
          password: 'some-password-123',
        },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns user info when authenticated', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com', password: 'secure-passphrase-123' },
      });
      const cookies = String(loginRes.headers['set-cookie']);

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: cookies },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.displayName).toBe('Test User');
    });

    it('returns 401 without session', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears session', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com', password: 'secure-passphrase-123' },
      });
      const cookies = String(loginRes.headers['set-cookie']);

      const logoutRes = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { cookie: cookies },
      });
      expect(logoutRes.statusCode).toBe(200);

      const meRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: cookies },
      });
      expect(meRes.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/request-reset', () => {
    it('accepts valid email without revealing existence', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/request-reset',
        payload: { email: 'test@example.com' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('accepts non-existent email without revealing existence', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/request-reset',
        payload: { email: 'ghost@example.com' },
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
