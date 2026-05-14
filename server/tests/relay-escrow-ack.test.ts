/**
 * relay-escrow-ack.test.ts — Trust acknowledgement gate for Relay Escrow.
 *
 * Verifies:
 *  - enable escrow rejected without acknowledgement (409 acknowledgement_required)
 *  - global POST /api/relay/escrow/acknowledge creates versioned record in trust_acknowledgements
 *  - enable escrow succeeds after acknowledgement
 *  - stale acknowledgement version rejected (version mismatch ignored — only current version rows count)
 *  - unsubscribed user with cancelled subscription rejected from escrow operations
 *
 * These tests focus on the acknowledgement gate introduced in Task 4.
 * The underlying escrow material tests live in relay-escrow.test.ts.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { buildApp } from '../src/index.js';
import { trustAcknowledgements, packets, subscriptions } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { RELAY_ESCROW_ACK_VERSION } from '../src/services/relay-escrow.js';

async function getCsrf(app: Awaited<ReturnType<typeof buildApp>>, cookies: string): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/api/csrf', headers: { cookie: cookies } });
  return JSON.parse(res.payload).csrfToken;
}

async function registerAndLogin(app: Awaited<ReturnType<typeof buildApp>>, suffix: string) {
  const email = `escrow-ack-${suffix}-${randomUUID()}@example.com`;
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { displayName: 'Escrow Ack Test', email, password: 'testpass12345', timezone: 'UTC' },
  });
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: 'testpass12345' },
  });
  const cookies = String(loginRes.headers['set-cookie']);
  const meRes = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookies } });
  const userId = JSON.parse(meRes.payload).id as string;
  return { cookies, email, userId };
}

async function createRelayConnection(
  app: Awaited<ReturnType<typeof buildApp>>,
  cookies: string,
): Promise<string> {
  const csrfToken = await getCsrf(app, cookies);
  const res = await app.inject({
    method: 'POST',
    url: '/api/relay/connections',
    headers: { cookie: cookies, 'x-csrf-token': csrfToken },
    payload: { label: 'Ack Test Server', mode: 'relay_monitoring' },
  });
  return JSON.parse(res.payload).connection.id;
}

async function createContact(
  app: Awaited<ReturnType<typeof buildApp>>,
  cookies: string,
): Promise<string> {
  const csrfToken = await getCsrf(app, cookies);
  const res = await app.inject({
    method: 'POST',
    url: '/api/contacts',
    headers: { cookie: cookies, 'x-csrf-token': csrfToken },
    payload: { fullName: 'Ack Contact', email: 'ack-c@example.com', preferredChannels: ['email'], confirmationWindowHours: 48 },
  });
  return JSON.parse(res.payload).contact.id;
}

describe('Relay Escrow trust acknowledgement gate', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;
  let userId: string;
  let connectionId: string;
  let contactId: string;
  let packetId: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    const user = await registerAndLogin(app, 'gate');
    cookies = user.cookies;
    userId = user.userId;
    connectionId = await createRelayConnection(app, cookies);
    contactId = await createContact(app, cookies);

    // Insert a packet directly
    const [packetRow] = await app.db
      .insert(packets)
      .values({ userId, version: 1, contentHash: 'acktesthash', keyId: 'ack-key-id' })
      .returning();
    packetId = packetRow.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Test 1: enable escrow rejected without acknowledgement ────────────────

  it('enable escrow rejected without acknowledgement (409 acknowledgement_required)', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: `/api/relay/${connectionId}/escrow/enable`,
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: {
        material: 'secret-release-key',
        materialType: 'release_key',
        contactIds: [contactId],
        packetId,
      },
    });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('acknowledgement_required');
  });

  // ── Test 2: global acknowledge creates versioned record ───────────────────

  it('global POST /api/relay/escrow/acknowledge creates versioned trust_acknowledgements row', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: '/api/relay/escrow/acknowledge',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.acknowledgementId).toBeDefined();
    expect(body.version).toBe(RELAY_ESCROW_ACK_VERSION);

    // Verify DB row
    const rows = await app.db
      .select()
      .from(trustAcknowledgements)
      .where(eq(trustAcknowledgements.id, body.acknowledgementId));
    expect(rows.length).toBe(1);
    expect(rows[0].mode).toBe('relay_escrow');
    expect(rows[0].version).toBe(RELAY_ESCROW_ACK_VERSION);
    expect(rows[0].userId).toBe(userId);
  });

  // ── Test 3: enable succeeds after acknowledgement ─────────────────────────

  it('enable escrow succeeds after global acknowledgement', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: `/api/relay/${connectionId}/escrow/enable`,
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: {
        material: 'secret-release-key',
        materialType: 'release_key',
        contactIds: [contactId],
        packetId,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.escrowId).toBeDefined();
    expect(body.enabled).toBe(true);
  });

  // ── Test 4: stale acknowledgement version rejected ────────────────────────

  it('stale acknowledgement version does not satisfy enable check (only current version rows count)', async () => {
    // Register a fresh user who has only a stale-version ack row directly in DB
    const staleUser = await registerAndLogin(app, 'stale');
    const staleConnectionId = await createRelayConnection(app, staleUser.cookies);
    const staleContactId = await createContact(app, staleUser.cookies);
    const [stalePacketRow] = await app.db
      .insert(packets)
      .values({ userId: staleUser.userId, version: 1, contentHash: 'stalehash', keyId: 'stale-key' })
      .returning();

    // Insert a trust_acknowledgement with a stale (wrong) version directly
    await app.db.insert(trustAcknowledgements).values({
      userId: staleUser.userId,
      mode: 'relay_escrow',
      version: 'relay-escrow-v0', // stale version
    });

    // Enable should still fail because only current-version rows are accepted
    const csrfToken = await getCsrf(app, staleUser.cookies);
    const res = await app.inject({
      method: 'POST',
      url: `/api/relay/${staleConnectionId}/escrow/enable`,
      headers: { cookie: staleUser.cookies, 'x-csrf-token': csrfToken },
      payload: {
        material: 'key',
        materialType: 'release_key',
        contactIds: [staleContactId],
        packetId: stalePacketRow.id,
      },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.payload).error).toBe('acknowledgement_required');
  });

  // ── Test 5: unsubscribed (cancelled) user rejected ────────────────────────

  it('user with cancelled subscription is rejected by global acknowledge (403)', async () => {
    const cancelledUser = await registerAndLogin(app, 'cancelled');

    // Give them a relay connection and then cancel their subscription
    const connId = await createRelayConnection(app, cancelledUser.cookies);

    // Insert a cancelled subscription record
    await app.db.insert(subscriptions).values({
      userId: cancelledUser.userId,
      stripeCustomerId: 'cus_test_cancelled',
      stripeSubscriptionId: 'sub_test_cancelled',
      plan: 'relay',
      status: 'cancelled',
    });

    const csrfToken = await getCsrf(app, cancelledUser.cookies);
    const res = await app.inject({
      method: 'POST',
      url: '/api/relay/escrow/acknowledge',
      headers: { cookie: cancelledUser.cookies, 'x-csrf-token': csrfToken },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.error).toMatch(/subscription/i);
  });

  // ── Auth / CSRF guards for global endpoint ────────────────────────────────

  it('global acknowledge without auth returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/relay/escrow/acknowledge',
      payload: {},
    });
    expect(res.statusCode).toBe(401);
  });

  it('global acknowledge without CSRF returns 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/relay/escrow/acknowledge',
      headers: { cookie: cookies },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
  });

  // ── disable endpoint ──────────────────────────────────────────────────────

  it('POST /api/relay/:id/escrow/disable disables active escrow (200)', async () => {
    // Use the connection from the main user (already has escrow enabled from test 3)
    const csrfToken = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: `/api/relay/${connectionId}/escrow/disable`,
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.disabled).toBe(true);
  });

  it('GET escrow status after disable shows enabled false', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/relay/${connectionId}/escrow`,
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.enabled).toBe(false);
  });
});
