import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/index.js';
import { users, auditEvents } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

async function getCsrf(app: Awaited<ReturnType<typeof buildApp>>, cookies: string): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/api/csrf', headers: { cookie: cookies } });
  return JSON.parse(res.payload).csrfToken;
}

async function registerAndLogin(
  app: Awaited<ReturnType<typeof buildApp>>,
  email: string,
): Promise<string> {
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      displayName: 'Settings Test User',
      email,
      password: 'testpass12345',
      timezone: 'UTC',
    },
  });
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: 'testpass12345' },
  });
  return String(loginRes.headers['set-cookie']);
}

describe('Account Settings', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;
  let userId: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    cookies = await registerAndLogin(app, 'settings@example.com');
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: cookies },
    });
    userId = JSON.parse(meRes.payload).id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── GET /api/settings/account ──────────────────────────────────────────────

  describe('GET /api/settings/account', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/settings/account' });
      expect(res.statusCode).toBe(401);
    });

    it('returns account info for authenticated user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/settings/account',
        headers: { cookie: cookies },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty('email');
      expect(body).toHaveProperty('emailVerified');
      expect(body).toHaveProperty('createdAt');
      expect(body).toHaveProperty('displayName');
    });

    it('does not return passwordHash in response', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/settings/account',
        headers: { cookie: cookies },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).not.toHaveProperty('passwordHash');
      expect(body).not.toHaveProperty('password_hash');
    });

    it('does not return sensitive token fields', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/settings/account',
        headers: { cookie: cookies },
      });
      const body = JSON.parse(res.payload);
      expect(body).not.toHaveProperty('emailVerifyToken');
      expect(body).not.toHaveProperty('passwordResetTokenHash');
      expect(body).not.toHaveProperty('totpSecretEncrypted');
    });
  });

  // ── PUT /api/settings/account ──────────────────────────────────────────────

  describe('PUT /api/settings/account', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/settings/account',
        payload: { displayName: 'New Name' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 403 for missing CSRF token', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/settings/account',
        headers: { cookie: cookies },
        payload: { displayName: 'New Name' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('updates displayName successfully', async () => {
      const csrf = await getCsrf(app, cookies);
      const res = await app.inject({
        method: 'PUT',
        url: '/api/settings/account',
        headers: { cookie: cookies, 'x-csrf-token': csrf },
        payload: { displayName: 'Updated Name' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.displayName).toBe('Updated Name');
    });

    it('persists displayName change in DB', async () => {
      const csrf = await getCsrf(app, cookies);
      await app.inject({
        method: 'PUT',
        url: '/api/settings/account',
        headers: { cookie: cookies, 'x-csrf-token': csrf },
        payload: { displayName: 'DB Verified Name' },
      });

      const [dbUser] = await app.db.select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, userId));
      expect(dbUser.displayName).toBe('DB Verified Name');
    });

    it('writes audit event for profile update', async () => {
      const csrf = await getCsrf(app, cookies);
      await app.inject({
        method: 'PUT',
        url: '/api/settings/account',
        headers: { cookie: cookies, 'x-csrf-token': csrf },
        payload: { displayName: 'Audit Name' },
      });

      const events = await app.db.select()
        .from(auditEvents)
        .where(eq(auditEvents.userId, userId));

      const profileEvents = events.filter(e => e.eventType === 'profile_updated');
      expect(profileEvents.length).toBeGreaterThan(0);
    });

    it('rejects email change (not supported in alpha)', async () => {
      const csrf = await getCsrf(app, cookies);
      const res = await app.inject({
        method: 'PUT',
        url: '/api/settings/account',
        headers: { cookie: cookies, 'x-csrf-token': csrf },
        payload: { email: 'newemail@example.com' },
      });
      // Either 400 (bad request) or ignored — must not update email
      if (res.statusCode === 200) {
        const [dbUser] = await app.db.select({ email: users.email })
          .from(users)
          .where(eq(users.id, userId));
        expect(dbUser.email).not.toBe('newemail@example.com');
      } else {
        expect(res.statusCode).toBe(400);
      }
    });

    it('does not return passwordHash in PUT response', async () => {
      const csrf = await getCsrf(app, cookies);
      const res = await app.inject({
        method: 'PUT',
        url: '/api/settings/account',
        headers: { cookie: cookies, 'x-csrf-token': csrf },
        payload: { displayName: 'Safe Name' },
      });
      const body = JSON.parse(res.payload);
      expect(body).not.toHaveProperty('passwordHash');
    });
  });

  // ── POST /api/security/change-password ────────────────────────────────────

  describe('POST /api/security/change-password', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/security/change-password',
        payload: {
          currentPassword: 'testpass12345',
          newPassword: 'newpass99999',
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 403 for missing CSRF token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/security/change-password',
        headers: { cookie: cookies },
        payload: {
          currentPassword: 'testpass12345',
          newPassword: 'newpass99999',
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('rejects wrong current password with 401', async () => {
      const csrf = await getCsrf(app, cookies);
      const res = await app.inject({
        method: 'POST',
        url: '/api/security/change-password',
        headers: { cookie: cookies, 'x-csrf-token': csrf },
        payload: {
          currentPassword: 'wrongpassword!',
          newPassword: 'newpass99999',
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects new password shorter than 8 chars', async () => {
      const csrf = await getCsrf(app, cookies);
      const res = await app.inject({
        method: 'POST',
        url: '/api/security/change-password',
        headers: { cookie: cookies, 'x-csrf-token': csrf },
        payload: {
          currentPassword: 'testpass12345',
          newPassword: 'short',
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('changes password successfully and updates hash in DB', async () => {
      // Use a dedicated user for this test to avoid coupling with other tests
      const pwCookies = await registerAndLogin(app, 'pwchange@example.com');
      const pwMeRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: pwCookies },
      });
      const pwUserId = JSON.parse(pwMeRes.payload).id;

      // Capture old hash
      const [before] = await app.db.select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, pwUserId));

      const csrf = await getCsrf(app, pwCookies);
      const res = await app.inject({
        method: 'POST',
        url: '/api/security/change-password',
        headers: { cookie: pwCookies, 'x-csrf-token': csrf },
        payload: {
          currentPassword: 'testpass12345',
          newPassword: 'newSecurePass99',
        },
      });
      expect(res.statusCode).toBe(200);

      // Verify hash changed in DB
      const [after] = await app.db.select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, pwUserId));

      expect(after.passwordHash).not.toBe(before.passwordHash);
    });

    it('writes audit event for password change', async () => {
      const auditCookies = await registerAndLogin(app, 'auditpw@example.com');
      const auditMeRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: auditCookies },
      });
      const auditUserId = JSON.parse(auditMeRes.payload).id;

      const csrf = await getCsrf(app, auditCookies);
      await app.inject({
        method: 'POST',
        url: '/api/security/change-password',
        headers: { cookie: auditCookies, 'x-csrf-token': csrf },
        payload: {
          currentPassword: 'testpass12345',
          newPassword: 'audittest9999',
        },
      });

      const events = await app.db.select()
        .from(auditEvents)
        .where(eq(auditEvents.userId, auditUserId));

      const pwEvents = events.filter(e => e.eventType === 'password_changed');
      expect(pwEvents.length).toBeGreaterThan(0);
    });

    it('does not return passwordHash in success response', async () => {
      const csrf = await getCsrf(app, cookies);
      const res = await app.inject({
        method: 'POST',
        url: '/api/security/change-password',
        headers: { cookie: cookies, 'x-csrf-token': csrf },
        payload: {
          currentPassword: 'testpass12345',
          newPassword: 'anotherNewPass99',
        },
      });
      if (res.statusCode === 200) {
        const body = JSON.parse(res.payload);
        expect(body).not.toHaveProperty('passwordHash');
      }
    });
  });
});
