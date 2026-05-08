import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/index.js';

async function getCsrf(app: Awaited<ReturnType<typeof buildApp>>, cookies: string): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/api/csrf', headers: { cookie: cookies } });
  return JSON.parse(res.payload).csrfToken;
}

async function registerAndLogin(
  app: Awaited<ReturnType<typeof buildApp>>,
  email: string,
  password = 'testpass12345',
): Promise<string> {
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { displayName: 'HB Test', email, password, timezone: 'UTC' },
  });
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });
  return String(loginRes.headers['set-cookie']);
}

async function createConnection(
  app: Awaited<ReturnType<typeof buildApp>>,
  cookies: string,
  label = 'Test Connection',
): Promise<{ id: string; apiKey: string }> {
  const csrfToken = await getCsrf(app, cookies);
  const res = await app.inject({
    method: 'POST',
    url: '/api/relay/connections',
    headers: { cookie: cookies, 'x-csrf-token': csrfToken },
    payload: { label, mode: 'relay_monitoring' },
  });
  const body = JSON.parse(res.payload);
  return { id: body.connection.id, apiKey: body.apiKey };
}

function validHeartbeat(connectionId: string) {
  return {
    version: 1 as const,
    relayConnectionId: connectionId,
    timestamp: new Date().toISOString(),
    mode: 'relay_monitoring' as const,
    switchCount: 3,
  };
}

describe('Relay Heartbeat API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    cookies = await registerAndLogin(app, 'heartbeat@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/relay/heartbeat', () => {
    it('accepts a valid heartbeat with correct Bearer token (200)', async () => {
      const { id, apiKey } = await createConnection(app, cookies, 'Valid HB Test');
      const res = await app.inject({
        method: 'POST',
        url: '/api/relay/heartbeat',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: validHeartbeat(id),
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.accepted).toBe(true);
      expect(body.serverTimestamp).toBeDefined();
    });

    it('rejects request with missing Authorization header (401)', async () => {
      const { id } = await createConnection(app, cookies, 'No Auth');
      const res = await app.inject({
        method: 'POST',
        url: '/api/relay/heartbeat',
        payload: validHeartbeat(id),
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe('missing');
    });

    it('rejects request with invalid API key (401)', async () => {
      const { id } = await createConnection(app, cookies, 'Wrong Key');
      const res = await app.inject({
        method: 'POST',
        url: '/api/relay/heartbeat',
        headers: { authorization: 'Bearer rlk_thisisnotavalidkey0000000000000000000000000000000000000000000000' },
        payload: validHeartbeat(id),
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe('invalid');
    });

    it('rejects request from a revoked connection (401)', async () => {
      const { id, apiKey } = await createConnection(app, cookies, 'Will Be Revoked');
      // Revoke the connection
      const csrfToken = await getCsrf(app, cookies);
      await app.inject({
        method: 'POST',
        url: `/api/relay/connections/${id}/revoke`,
        headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/relay/heartbeat',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: validHeartbeat(id),
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe('revoked');
    });

    it('rejects malformed heartbeat payload (400)', async () => {
      const { apiKey } = await createConnection(app, cookies, 'Malformed');
      const res = await app.inject({
        method: 'POST',
        url: '/api/relay/heartbeat',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { version: 1, mode: 'relay_monitoring' }, // missing required fields
      });
      expect(res.statusCode).toBe(400);
    });

    it('updates lastHeartbeatAt after a successful heartbeat', async () => {
      const { id, apiKey } = await createConnection(app, cookies, 'Heartbeat Update');

      // Verify lastHeartbeatAt is null before
      const beforeRes = await app.inject({
        method: 'GET',
        url: `/api/relay/connections/${id}`,
        headers: { cookie: cookies },
      });
      expect(JSON.parse(beforeRes.payload).connection.lastHeartbeatAt).toBeNull();

      // Send heartbeat
      await app.inject({
        method: 'POST',
        url: '/api/relay/heartbeat',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: validHeartbeat(id),
      });

      // Verify lastHeartbeatAt is set after
      const afterRes = await app.inject({
        method: 'GET',
        url: `/api/relay/connections/${id}`,
        headers: { cookie: cookies },
      });
      expect(JSON.parse(afterRes.payload).connection.lastHeartbeatAt).not.toBeNull();
    });

    it('does not require CSRF token (machine-to-machine)', async () => {
      const { id, apiKey } = await createConnection(app, cookies, 'No CSRF Required');
      // No x-csrf-token header — should succeed
      const res = await app.inject({
        method: 'POST',
        url: '/api/relay/heartbeat',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: validHeartbeat(id),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /api/relay/status', () => {
    it('returns active status after a heartbeat', async () => {
      const { id, apiKey } = await createConnection(app, cookies, 'Status After HB');

      // Send heartbeat first
      await app.inject({
        method: 'POST',
        url: '/api/relay/heartbeat',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: validHeartbeat(id),
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/relay/status',
        headers: { authorization: `Bearer ${apiKey}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.accepted).toBe(true);
      expect(body.status).toBe('active');
      expect(body.lastHeartbeatAt).not.toBeNull();
      expect(body.nextExpectedAt).not.toBeNull();
    });

    it('returns null lastHeartbeatAt for a fresh connection that has never sent a heartbeat', async () => {
      const { apiKey } = await createConnection(app, cookies, 'Fresh Connection');

      const res = await app.inject({
        method: 'GET',
        url: '/api/relay/status',
        headers: { authorization: `Bearer ${apiKey}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.lastHeartbeatAt).toBeNull();
    });

    it('rejects unauthenticated status check (401)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/relay/status',
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
