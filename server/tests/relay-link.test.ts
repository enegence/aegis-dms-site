import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash } from 'crypto';
import { buildApp } from '../src/index.js';
import { relayLinkCodes, relayConnections } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { isValidCallbackUrl } from '../src/services/relay-link.js';

async function getCsrf(app: Awaited<ReturnType<typeof buildApp>>, cookies: string): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/api/csrf', headers: { cookie: cookies } });
  return JSON.parse(res.payload).csrfToken;
}

describe('Relay link code — isValidCallbackUrl', () => {
  it('accepts https URLs', () => {
    expect(isValidCallbackUrl('https://myserver.example.com')).toBe(true);
    expect(isValidCallbackUrl('https://192.168.1.1:8080')).toBe(true);
  });

  it('accepts http localhost / private IPs', () => {
    expect(isValidCallbackUrl('http://localhost:3000')).toBe(true);
    expect(isValidCallbackUrl('http://127.0.0.1:8080')).toBe(true);
    expect(isValidCallbackUrl('http://192.168.1.50:4000')).toBe(true);
    expect(isValidCallbackUrl('http://10.0.0.1')).toBe(true);
    expect(isValidCallbackUrl('http://172.16.0.1')).toBe(true);
    expect(isValidCallbackUrl('http://172.31.255.255')).toBe(true);
  });

  it('rejects http public addresses', () => {
    expect(isValidCallbackUrl('http://myserver.example.com')).toBe(false);
    expect(isValidCallbackUrl('http://8.8.8.8')).toBe(false);
    expect(isValidCallbackUrl('http://172.32.0.1')).toBe(false); // outside RFC-1918 range
    expect(isValidCallbackUrl('http://172.15.0.1')).toBe(false);
  });

  it('rejects non-URL strings', () => {
    expect(isValidCallbackUrl('not a url')).toBe(false);
    expect(isValidCallbackUrl('')).toBe(false);
  });
});

describe('POST /api/relay/link/start', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;
  let otherCookies: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { displayName: 'Link User', email: 'link@example.com', password: 'testpass12345', timezone: 'UTC' },
    });
    const loginRes = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'link@example.com', password: 'testpass12345' },
    });
    cookies = String(loginRes.headers['set-cookie']);

    await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { displayName: 'Other', email: 'link-other@example.com', password: 'testpass12345', timezone: 'UTC' },
    });
    const otherRes = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'link-other@example.com', password: 'testpass12345' },
    });
    otherCookies = String(otherRes.headers['set-cookie']);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns code, linkCodeId, exchangeUrl for authenticated user (201)', async () => {
    const csrf = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST', url: '/api/relay/link/start',
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: { callbackUrl: 'http://localhost:3000', state: 'randomstate12345678', label: 'Home Server' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.code).toBeDefined();
    expect(typeof body.code).toBe('string');
    expect(body.code.length).toBeGreaterThan(16);
    expect(body.linkCodeId).toBeDefined();
    expect(body.exchangeUrl).toContain('/api/relay/link/exchange');
  });

  it('stores only SHA-256 hash of code — not plaintext', async () => {
    const csrf = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST', url: '/api/relay/link/start',
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: { callbackUrl: 'http://localhost:3000', state: 'statehashcheck1234', label: 'Hash Test' },
    });
    expect(res.statusCode).toBe(201);
    const { code, linkCodeId } = JSON.parse(res.payload);

    const rows = await app.db.select().from(relayLinkCodes).where(eq(relayLinkCodes.id, linkCodeId));
    expect(rows).toHaveLength(1);

    const row = rows[0];
    // Plaintext must NOT be stored
    expect(row.codeHash).not.toBe(code);
    // Hash must match SHA-256 of returned code
    const expectedHash = createHash('sha256').update(code).digest('hex');
    expect(row.codeHash).toBe(expectedHash);
  });

  it('rejects invalid callbackUrl (http public address)', async () => {
    const csrf = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST', url: '/api/relay/link/start',
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: { callbackUrl: 'http://evil.example.com', state: 'stateval1234567890', label: 'Bad URL' },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('invalid_callback_url');
  });

  it('rejects unauthenticated request with 401', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/relay/link/start',
      payload: { callbackUrl: 'http://localhost:3000', state: 'somestate12345678' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects request without CSRF token with 403', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/relay/link/start',
      headers: { cookie: cookies },
      payload: { callbackUrl: 'http://localhost:3000', state: 'somestate12345678' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('POST /api/relay/link/exchange', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { displayName: 'Exchange User', email: 'exchange@example.com', password: 'testpass12345', timezone: 'UTC' },
    });
    const loginRes = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'exchange@example.com', password: 'testpass12345' },
    });
    cookies = String(loginRes.headers['set-cookie']);
  });

  afterAll(async () => {
    await app.close();
  });

  async function startLink(state: string, label?: string) {
    const csrf = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST', url: '/api/relay/link/start',
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: { callbackUrl: 'http://localhost:3000', state, label },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.payload) as { code: string; linkCodeId: string };
  }

  it('exchange returns relayEndpoint, apiKey, connectionId (201)', async () => {
    const state = 'validstate-exchange-001';
    const { code } = await startLink(state, 'Exchange Test');

    const res = await app.inject({
      method: 'POST', url: '/api/relay/link/exchange',
      payload: { code, state, instanceLabel: 'My OSS Instance' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.apiKey).toBeDefined();
    expect(body.apiKey).toMatch(/^rlk_/);
    expect(body.connectionId).toBeDefined();
    expect(body.relayEndpoint).toContain('/api/relay/heartbeat');
  });

  it('exchange creates a relay connection in DB with hashed key', async () => {
    const state = 'validstate-dbcheck-002';
    const { code } = await startLink(state, 'DB Check');

    const res = await app.inject({
      method: 'POST', url: '/api/relay/link/exchange',
      payload: { code, state },
    });
    expect(res.statusCode).toBe(201);
    const { apiKey, connectionId } = JSON.parse(res.payload);

    const rows = await app.db.select().from(relayConnections).where(eq(relayConnections.id, connectionId));
    expect(rows).toHaveLength(1);

    const row = rows[0];
    // API key plaintext must NOT be stored
    expect(row.apiKeyHash).not.toBe(apiKey);
    // Hash must match
    const expectedHash = createHash('sha256').update(apiKey).digest('hex');
    expect(row.apiKeyHash).toBe(expectedHash);
    expect(row.status).toBe('active');
  });

  it('exchange marks code as used — re-exchange with same code returns 410', async () => {
    const state = 'validstate-reuse-003';
    const { code } = await startLink(state, 'Reuse Test');

    const first = await app.inject({
      method: 'POST', url: '/api/relay/link/exchange',
      payload: { code, state },
    });
    expect(first.statusCode).toBe(201);

    // Second attempt with same code
    const second = await app.inject({
      method: 'POST', url: '/api/relay/link/exchange',
      payload: { code, state },
    });
    expect(second.statusCode).toBe(410);
  });

  it('state mismatch returns 400', async () => {
    const state = 'correctstate-004';
    const { code } = await startLink(state, 'State Test');

    const res = await app.inject({
      method: 'POST', url: '/api/relay/link/exchange',
      payload: { code, state: 'WRONG_STATE_VALUE' },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('State mismatch');
  });

  it('expired code returns 410', async () => {
    // Insert an already-expired code directly
    const { relayLinkCodes: linkCodesTable } = await import('../src/db/schema.js');
    const { createHash: ch } = await import('crypto');
    const fakeCode = 'fake-expired-code-0000000000000000000000000000000000000000000000001';
    const fakeHash = ch('sha256').update(fakeCode).digest('hex');

    // Get userId from the test user
    const { users } = await import('../src/db/schema.js');
    const { eq: eqOp } = await import('drizzle-orm');
    const [user] = await app.db.select({ id: users.id }).from(users).where(eqOp(users.email, 'exchange@example.com'));

    await app.db.insert(linkCodesTable).values({
      userId: user.id,
      codeHash: fakeHash,
      callbackUrl: 'http://localhost:3000',
      state: 'expiredstate',
      nonce: 'abc123nonce',
      label: 'Expired Test',
      expiresAt: new Date(Date.now() - 1000), // already expired
    });

    const res = await app.inject({
      method: 'POST', url: '/api/relay/link/exchange',
      payload: { code: fakeCode, state: 'expiredstate' },
    });
    expect(res.statusCode).toBe(410);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('expired');
  });

  it('unknown code returns 404', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/relay/link/exchange',
      payload: { code: 'totally-unknown-code', state: 'anystate' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('exchange does not require CSRF token (server-to-server)', async () => {
    // No session cookies, no CSRF header — should still work
    const state = 'nocookiestate-005';
    const { code } = await startLink(state, 'No Cookie Test');

    const res = await app.inject({
      method: 'POST', url: '/api/relay/link/exchange',
      // No cookie header, no CSRF header
      payload: { code, state },
    });
    expect(res.statusCode).toBe(201);
  });
});

describe('Revoked connection rejects heartbeat', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { displayName: 'Revoke Hb', email: 'revokehb@example.com', password: 'testpass12345', timezone: 'UTC' },
    });
    const loginRes = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'revokehb@example.com', password: 'testpass12345' },
    });
    cookies = String(loginRes.headers['set-cookie']);
  });

  afterAll(async () => { await app.close(); });

  it('revoked connection API key is rejected at heartbeat endpoint (401)', async () => {
    // Create a connection via link exchange
    const csrf = await getCsrf(app, cookies);
    const startRes = await app.inject({
      method: 'POST', url: '/api/relay/link/start',
      headers: { cookie: cookies, 'x-csrf-token': csrf },
      payload: { callbackUrl: 'http://localhost:3000', state: 'revoketest-heartbeat-001', label: 'Revoke HB' },
    });
    const { code } = JSON.parse(startRes.payload);

    const exchangeRes = await app.inject({
      method: 'POST', url: '/api/relay/link/exchange',
      payload: { code, state: 'revoketest-heartbeat-001' },
    });
    const { apiKey, connectionId } = JSON.parse(exchangeRes.payload);

    // Revoke the connection
    const csrf2 = await getCsrf(app, cookies);
    await app.inject({
      method: 'POST', url: `/api/relay/connections/${connectionId}/revoke`,
      headers: { cookie: cookies, 'x-csrf-token': csrf2 },
    });

    // Heartbeat with the revoked key should fail
    const hbRes = await app.inject({
      method: 'POST', url: '/api/relay/heartbeat',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: {
        relayConnectionId: connectionId,
        switchCount: 1,
        mode: 'relay_monitoring',
        timestamp: new Date().toISOString(),
      },
    });
    expect(hbRes.statusCode).toBe(401);
  });
});
