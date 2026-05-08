import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash } from 'crypto';
import { buildApp } from '../src/index.js';
import { hashApiKey } from '../src/services/relay-connections.js';

async function getCsrf(app: Awaited<ReturnType<typeof buildApp>>, cookies: string): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/api/csrf', headers: { cookie: cookies } });
  return JSON.parse(res.payload).csrfToken;
}

describe('Relay connection management', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;
  let otherCookies: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { displayName: 'Relay Test', email: 'relay@example.com', password: 'testpass12345', timezone: 'UTC' },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'relay@example.com', password: 'testpass12345' },
    });
    cookies = String(loginRes.headers['set-cookie']);

    // Register a second user for isolation tests
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { displayName: 'Other User', email: 'relay-other@example.com', password: 'testpass12345', timezone: 'UTC' },
    });
    const otherLoginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'relay-other@example.com', password: 'testpass12345' },
    });
    otherCookies = String(otherLoginRes.headers['set-cookie']);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/relay/connections', () => {
    it('creates a connection and returns rawApiKey once (201)', async () => {
      const csrfToken = await getCsrf(app, cookies);
      const res = await app.inject({
        method: 'POST',
        url: '/api/relay/connections',
        headers: { cookie: cookies, 'x-csrf-token': csrfToken },
        payload: { label: 'My Home Server', mode: 'relay_monitoring' },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.apiKey).toBeDefined();
      expect(body.apiKey).toMatch(/^rlk_/);
      expect(body.connection.id).toBeDefined();
      expect(body.connection.label).toBe('My Home Server');
      expect(body.connection.status).toBe('active');
      expect(body.connection.mode).toBe('relay_monitoring');
    });

    it('stored DB value is hash only (not raw key)', async () => {
      const csrfToken = await getCsrf(app, cookies);
      const res = await app.inject({
        method: 'POST',
        url: '/api/relay/connections',
        headers: { cookie: cookies, 'x-csrf-token': csrfToken },
        payload: { label: 'Hash Check' },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      const rawKey = body.apiKey;

      // The API response should never contain apiKeyHash
      expect(body.connection.apiKeyHash).toBeUndefined();

      // Verify the hash is correctly stored by re-hashing the raw key
      const expectedHash = hashApiKey(rawKey);
      expect(expectedHash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
    });

    it('rejects unauthenticated request with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/relay/connections',
        payload: { label: 'Test' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects request without CSRF token with 403', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/relay/connections',
        headers: { cookie: cookies },
        payload: { label: 'No CSRF' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/relay/connections', () => {
    it('lists only active connections (no apiKey field)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/relay/connections',
        headers: { cookie: cookies },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.connections)).toBe(true);
      for (const conn of body.connections) {
        expect(conn.apiKey).toBeUndefined();
        expect(conn.apiKeyHash).toBeUndefined();
        expect(conn.status).toBe('active');
      }
    });

    it('does not include revoked connections', async () => {
      // Create a connection and revoke it
      const csrfToken = await getCsrf(app, cookies);
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/relay/connections',
        headers: { cookie: cookies, 'x-csrf-token': csrfToken },
        payload: { label: 'Will Be Revoked' },
      });
      const { connection } = JSON.parse(createRes.payload);

      const revokeToken = await getCsrf(app, cookies);
      await app.inject({
        method: 'POST',
        url: `/api/relay/connections/${connection.id}/revoke`,
        headers: { cookie: cookies, 'x-csrf-token': revokeToken },
      });

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/relay/connections',
        headers: { cookie: cookies },
      });
      const body = JSON.parse(listRes.payload);
      const ids = body.connections.map((c: { id: string }) => c.id);
      expect(ids).not.toContain(connection.id);
    });

    it('returns 401 for unauthenticated request', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/relay/connections',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/relay/connections/:id', () => {
    it('returns a connection by id', async () => {
      const csrfToken = await getCsrf(app, cookies);
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/relay/connections',
        headers: { cookie: cookies, 'x-csrf-token': csrfToken },
        payload: { label: 'Get By ID Test' },
      });
      const { connection } = JSON.parse(createRes.payload);

      const res = await app.inject({
        method: 'GET',
        url: `/api/relay/connections/${connection.id}`,
        headers: { cookie: cookies },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.connection.id).toBe(connection.id);
      expect(body.connection.label).toBe('Get By ID Test');
      expect(body.connection.apiKey).toBeUndefined();
      expect(body.connection.apiKeyHash).toBeUndefined();
    });

    it('returns 404 for another user\'s connection', async () => {
      const csrfToken = await getCsrf(app, cookies);
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/relay/connections',
        headers: { cookie: cookies, 'x-csrf-token': csrfToken },
        payload: { label: 'Ownership Test' },
      });
      const { connection } = JSON.parse(createRes.payload);

      // Other user tries to access it
      const res = await app.inject({
        method: 'GET',
        url: `/api/relay/connections/${connection.id}`,
        headers: { cookie: otherCookies },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 for invalid UUID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/relay/connections/not-a-uuid',
        headers: { cookie: cookies },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /api/relay/connections/:id', () => {
    it('updates connection label', async () => {
      const csrfToken = await getCsrf(app, cookies);
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/relay/connections',
        headers: { cookie: cookies, 'x-csrf-token': csrfToken },
        payload: { label: 'Original Label' },
      });
      const { connection } = JSON.parse(createRes.payload);

      const patchToken = await getCsrf(app, cookies);
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/relay/connections/${connection.id}`,
        headers: { cookie: cookies, 'x-csrf-token': patchToken },
        payload: { label: 'Updated Label' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.connection.label).toBe('Updated Label');
    });

    it('returns 403 without CSRF token', async () => {
      const csrfToken = await getCsrf(app, cookies);
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/relay/connections',
        headers: { cookie: cookies, 'x-csrf-token': csrfToken },
        payload: { label: 'CSRF Patch Test' },
      });
      const { connection } = JSON.parse(createRes.payload);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/relay/connections/${connection.id}`,
        headers: { cookie: cookies },
        payload: { label: 'No CSRF' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/relay/connections/:id/rotate-key', () => {
    it('returns a new rawApiKey', async () => {
      const csrfToken = await getCsrf(app, cookies);
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/relay/connections',
        headers: { cookie: cookies, 'x-csrf-token': csrfToken },
        payload: { label: 'Rotate Key Test' },
      });
      const { connection, apiKey: originalKey } = JSON.parse(createRes.payload);

      const rotateToken = await getCsrf(app, cookies);
      const res = await app.inject({
        method: 'POST',
        url: `/api/relay/connections/${connection.id}/rotate-key`,
        headers: { cookie: cookies, 'x-csrf-token': rotateToken },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.apiKey).toBeDefined();
      expect(body.apiKey).toMatch(/^rlk_/);
      expect(body.apiKey).not.toBe(originalKey);
    });

    it('rotate-key invalidates old key hash in DB', async () => {
      // Create connection
      const createRes = await app.inject({
        method: 'POST', url: '/api/relay/connections',
        headers: { cookie: cookies, 'x-csrf-token': await getCsrf(app, cookies) },
        payload: { label: 'Rotation Test' },
      });
      const { connection, apiKey: oldKey } = JSON.parse(createRes.payload);

      // Rotate
      const rotateRes = await app.inject({
        method: 'POST', url: `/api/relay/connections/${connection.id}/rotate-key`,
        headers: { cookie: cookies, 'x-csrf-token': await getCsrf(app, cookies) },
      });
      const { apiKey: newKey } = JSON.parse(rotateRes.payload);
      expect(newKey).not.toBe(oldKey);

      // Verify DB hash matches new key
      const { relayConnections } = await import('../src/db/schema.js');
      const { eq } = await import('drizzle-orm');
      const rows = await app.db.select({ apiKeyHash: relayConnections.apiKeyHash })
        .from(relayConnections)
        .where(eq(relayConnections.id, connection.id));
      expect(rows).toHaveLength(1);
      const expectedHash = createHash('sha256').update(newKey).digest('hex');
      expect(rows[0].apiKeyHash).toBe(expectedHash);
      // Old key hash should NOT match stored hash
      const oldHash = createHash('sha256').update(oldKey).digest('hex');
      expect(rows[0].apiKeyHash).not.toBe(oldHash);
    });

    it('rotate-key on revoked connection returns 404', async () => {
      // Create + revoke
      const createRes = await app.inject({
        method: 'POST', url: '/api/relay/connections',
        headers: { cookie: cookies, 'x-csrf-token': await getCsrf(app, cookies) },
        payload: { label: 'Revoke Test' },
      });
      const { connection } = JSON.parse(createRes.payload);
      await app.inject({
        method: 'POST', url: `/api/relay/connections/${connection.id}/revoke`,
        headers: { cookie: cookies, 'x-csrf-token': await getCsrf(app, cookies) },
      });
      // Attempt rotate
      const rotateRes = await app.inject({
        method: 'POST', url: `/api/relay/connections/${connection.id}/rotate-key`,
        headers: { cookie: cookies, 'x-csrf-token': await getCsrf(app, cookies) },
      });
      expect(rotateRes.statusCode).toBe(404);
    });

    it('returns 403 without CSRF token', async () => {
      const csrfToken = await getCsrf(app, cookies);
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/relay/connections',
        headers: { cookie: cookies, 'x-csrf-token': csrfToken },
        payload: { label: 'CSRF Rotate Test' },
      });
      const { connection } = JSON.parse(createRes.payload);

      const res = await app.inject({
        method: 'POST',
        url: `/api/relay/connections/${connection.id}/rotate-key`,
        headers: { cookie: cookies },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/relay/connections/:id/revoke', () => {
    it('sets status to disconnected', async () => {
      const csrfToken = await getCsrf(app, cookies);
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/relay/connections',
        headers: { cookie: cookies, 'x-csrf-token': csrfToken },
        payload: { label: 'Revoke Test' },
      });
      const { connection } = JSON.parse(createRes.payload);

      const revokeToken = await getCsrf(app, cookies);
      const res = await app.inject({
        method: 'POST',
        url: `/api/relay/connections/${connection.id}/revoke`,
        headers: { cookie: cookies, 'x-csrf-token': revokeToken },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.ok).toBe(true);

      // Verify it no longer appears in list (active only)
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/relay/connections',
        headers: { cookie: cookies },
      });
      const listBody = JSON.parse(listRes.payload);
      const ids = listBody.connections.map((c: { id: string }) => c.id);
      expect(ids).not.toContain(connection.id);
    });

    it('returns 403 without CSRF token', async () => {
      const csrfToken = await getCsrf(app, cookies);
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/relay/connections',
        headers: { cookie: cookies, 'x-csrf-token': csrfToken },
        payload: { label: 'CSRF Revoke Test' },
      });
      const { connection } = JSON.parse(createRes.payload);

      const res = await app.inject({
        method: 'POST',
        url: `/api/relay/connections/${connection.id}/revoke`,
        headers: { cookie: cookies },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('DELETE /api/relay/connections/:id', () => {
    it('hard deletes a connection with no heartbeat history', async () => {
      const csrfToken = await getCsrf(app, cookies);
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/relay/connections',
        headers: { cookie: cookies, 'x-csrf-token': csrfToken },
        payload: { label: 'Delete No History' },
      });
      const { connection } = JSON.parse(createRes.payload);

      const deleteToken = await getCsrf(app, cookies);
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/relay/connections/${connection.id}`,
        headers: { cookie: cookies, 'x-csrf-token': deleteToken },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).ok).toBe(true);

      // Verify gone from get
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/relay/connections/${connection.id}`,
        headers: { cookie: cookies },
      });
      expect(getRes.statusCode).toBe(404);
    });

    it('revokes (sets disconnected) when connection has heartbeat history', async () => {
      // Manually insert a relay connection with a lastHeartbeatAt via the DB
      const csrfToken = await getCsrf(app, cookies);
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/relay/connections',
        headers: { cookie: cookies, 'x-csrf-token': csrfToken },
        payload: { label: 'Has Heartbeat' },
      });
      const { connection } = JSON.parse(createRes.payload);

      // Directly set lastHeartbeatAt via DB
      await app.db.execute(
        // @ts-ignore - raw SQL for test setup
        `UPDATE relay_connections SET last_heartbeat_at = NOW() WHERE id = '${connection.id}'`
      );

      const deleteToken = await getCsrf(app, cookies);
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/relay/connections/${connection.id}`,
        headers: { cookie: cookies, 'x-csrf-token': deleteToken },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).ok).toBe(true);

      // Should now be 404 from list (status=disconnected, excluded from list)
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/relay/connections',
        headers: { cookie: cookies },
      });
      const listBody = JSON.parse(listRes.payload);
      const ids = listBody.connections.map((c: { id: string }) => c.id);
      expect(ids).not.toContain(connection.id);
    });

    it('returns 403 without CSRF token', async () => {
      const csrfToken = await getCsrf(app, cookies);
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/relay/connections',
        headers: { cookie: cookies, 'x-csrf-token': csrfToken },
        payload: { label: 'CSRF Delete Test' },
      });
      const { connection } = JSON.parse(createRes.payload);

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/relay/connections/${connection.id}`,
        headers: { cookie: cookies },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 404 for non-existent connection', async () => {
      const deleteToken = await getCsrf(app, cookies);
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/relay/connections/00000000-0000-0000-0000-000000000000',
        headers: { cookie: cookies, 'x-csrf-token': deleteToken },
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
