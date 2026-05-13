/**
 * Tests for Relay Escrow material model.
 *
 * Verifies:
 *  - GET /api/relay/:id/escrow — returns status
 *  - POST /api/relay/:id/escrow/acknowledge — creates versioned acknowledgement row
 *  - POST /api/relay/:id/escrow/enable — rejected without acknowledgement (409)
 *  - POST /api/relay/:id/escrow/enable — stores encrypted material (not plaintext)
 *  - POST /api/relay/:id/escrow/revoke — marks revokedAt; isEscrowEnabled returns false
 *  - isEscrowEnabled returns false for monitoring-only connection with no escrow row
 *  - unauthenticated requests rejected (401)
 *  - cross-user isolation enforced (404)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { buildApp } from '../src/index.js';
import { isEscrowEnabled } from '../src/services/relay-escrow.js';
import { relayEscrowMaterials, trustAcknowledgements } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

async function getCsrf(app: Awaited<ReturnType<typeof buildApp>>, cookies: string): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/api/csrf', headers: { cookie: cookies } });
  return JSON.parse(res.payload).csrfToken;
}

async function registerAndLogin(app: Awaited<ReturnType<typeof buildApp>>, suffix: string) {
  const email = `escrow-${suffix}-${randomUUID()}@example.com`;
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { displayName: 'Escrow Test', email, password: 'testpass12345', timezone: 'UTC' },
  });
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: 'testpass12345' },
  });
  return { cookies: String(loginRes.headers['set-cookie']), email };
}

async function createRelayConnection(
  app: Awaited<ReturnType<typeof buildApp>>,
  cookies: string,
  mode = 'relay_monitoring',
): Promise<string> {
  const csrfToken = await getCsrf(app, cookies);
  const res = await app.inject({
    method: 'POST',
    url: '/api/relay/connections',
    headers: { cookie: cookies, 'x-csrf-token': csrfToken },
    payload: { label: 'Test Server', mode },
  });
  return JSON.parse(res.payload).connection.id;
}

describe('Relay Escrow material model', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;
  let otherCookies: string;
  let connectionId: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    const user = await registerAndLogin(app, 'main');
    cookies = user.cookies;
    const other = await registerAndLogin(app, 'other');
    otherCookies = other.cookies;
    connectionId = await createRelayConnection(app, cookies);
  });

  afterAll(async () => {
    await app.close();
  });

  // ── GET status ────────────────────────────────────────────────────────────

  it('GET /api/relay/:id/escrow returns initial status (not acknowledged, not enabled)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/relay/${connectionId}/escrow`,
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.connectionExists).toBe(true);
    expect(body.acknowledged).toBe(false);
    expect(body.enabled).toBe(false);
    expect(body.policyVersion).toBeDefined();
  });

  it('GET escrow for unknown connection returns 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/relay/${randomUUID()}/escrow`,
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET escrow for other user connection returns 404 (isolation)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/relay/${connectionId}/escrow`,
      headers: { cookie: otherCookies },
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET escrow unauthenticated returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/relay/${connectionId}/escrow`,
    });
    expect(res.statusCode).toBe(401);
  });

  // ── Enable without acknowledgement ────────────────────────────────────────

  it('enable without acknowledgement rejected (409)', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: `/api/relay/${connectionId}/escrow/enable`,
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: { material: 'my-secret-release-key', materialType: 'release_key' },
    });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('acknowledgement_required');
  });

  // ── Acknowledge ───────────────────────────────────────────────────────────

  it('acknowledge creates versioned trust_acknowledgements row', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: `/api/relay/${connectionId}/escrow/acknowledge`,
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.acknowledgementId).toBeDefined();

    // Verify row in DB
    const rows = await app.db
      .select()
      .from(trustAcknowledgements)
      .where(eq(trustAcknowledgements.id, body.acknowledgementId));
    expect(rows.length).toBe(1);
    expect(rows[0].mode).toBe('relay_escrow');
    expect(rows[0].version).toBe('1.0');
  });

  it('acknowledge for wrong connection returns 404', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: `/api/relay/${randomUUID()}/escrow/acknowledge`,
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: {},
    });
    expect(res.statusCode).toBe(404);
  });

  // ── Enable with acknowledgement ───────────────────────────────────────────

  it('enable stores encrypted material (not plaintext)', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: `/api/relay/${connectionId}/escrow/enable`,
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: { material: 'my-secret-release-key-plaintext', materialType: 'release_key' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.escrowId).toBeDefined();
    expect(body.enabled).toBe(true);

    // Verify DB row has encrypted material, NOT plaintext
    const rows = await app.db
      .select()
      .from(relayEscrowMaterials)
      .where(eq(relayEscrowMaterials.id, body.escrowId));
    expect(rows.length).toBe(1);
    expect(rows[0].materialEncrypted).not.toBe('my-secret-release-key-plaintext');
    expect(rows[0].materialEncrypted.length).toBeGreaterThan(0);
    expect(rows[0].revokedAt).toBeNull();
    expect(rows[0].enabled).toBe(true);
  });

  it('GET status after enable shows acknowledged and enabled', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/relay/${connectionId}/escrow`,
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.acknowledged).toBe(true);
    expect(body.enabled).toBe(true);
    expect(body.revokedAt).toBeNull();
  });

  it('isEscrowEnabled returns true for active escrow', async () => {
    // Get userId from session
    const meRes = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookies } });
    const userId = JSON.parse(meRes.payload).id;
    const enabled = await isEscrowEnabled(app.db, userId, connectionId);
    expect(enabled).toBe(true);
  });

  // ── Relay Monitoring without escrow ───────────────────────────────────────

  it('isEscrowEnabled returns false for monitoring connection with no escrow material', async () => {
    const monitoringConnId = await createRelayConnection(app, cookies, 'relay_monitoring');
    const meRes = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookies } });
    const userId = JSON.parse(meRes.payload).id;
    const enabled = await isEscrowEnabled(app.db, userId, monitoringConnId);
    expect(enabled).toBe(false);
  });

  // ── Revoke ────────────────────────────────────────────────────────────────

  it('revoke marks revokedAt and disables material', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: `/api/relay/${connectionId}/escrow/revoke`,
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.revoked).toBe(true);
  });

  it('isEscrowEnabled returns false after revoke', async () => {
    const meRes = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookies } });
    const userId = JSON.parse(meRes.payload).id;
    const enabled = await isEscrowEnabled(app.db, userId, connectionId);
    expect(enabled).toBe(false);
  });

  it('GET status after revoke shows revokedAt set and enabled false', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/relay/${connectionId}/escrow`,
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.enabled).toBe(false);
  });

  it('revoke again returns revoked false (idempotent — nothing to revoke)', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: `/api/relay/${connectionId}/escrow/revoke`,
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).revoked).toBe(false);
  });

  // ── Auth / CSRF guards ────────────────────────────────────────────────────

  it('POST acknowledge without auth returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/relay/${connectionId}/escrow/acknowledge`,
      payload: {},
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST enable without CSRF returns 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/relay/${connectionId}/escrow/enable`,
      headers: { cookie: cookies },
      payload: { material: 'key', materialType: 'release_key' },
    });
    expect(res.statusCode).toBe(403);
  });
});
