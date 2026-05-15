/**
 * Tests for legal/trust pages and acceptance flows.
 *
 * Verifies:
 *  - POST /api/auth/register with termsVersion stores trust_acknowledgements row (mode='terms')
 *  - POST /api/auth/register without termsVersion succeeds (backward compat; no ack row)
 *  - GET /api/readiness reflects hosted trust acknowledgement status
 *  - POST /api/relay/:id/escrow/enable rejected without acknowledgement (covered in relay-escrow.test.ts)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { buildApp } from '../src/index.js';
import { trustAcknowledgements } from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';

async function getCsrf(app: Awaited<ReturnType<typeof buildApp>>, cookies: string): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/api/csrf', headers: { cookie: cookies } });
  return JSON.parse(res.payload).csrfToken;
}

describe('Legal pages — signup terms acknowledgement', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('register with termsVersion stores trust_acknowledgements row with mode=terms', async () => {
    const email = `legal-terms-${randomUUID()}@example.com`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        displayName: 'Legal Test',
        email,
        password: 'testpass12345',
        timezone: 'UTC',
        termsVersion: 'terms-v1',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    const userId = body.user.id;

    const rows = await app.db
      .select()
      .from(trustAcknowledgements)
      .where(and(eq(trustAcknowledgements.userId, userId), eq(trustAcknowledgements.mode, 'terms')));

    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe('terms-v1');
    expect(rows[0].acceptedAt).toBeInstanceOf(Date);
  });

  it('register without termsVersion creates no terms ack row', async () => {
    const email = `legal-noterms-${randomUUID()}@example.com`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        displayName: 'Legal Test No Terms',
        email,
        password: 'testpass12345',
        timezone: 'UTC',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    const userId = body.user.id;

    const rows = await app.db
      .select()
      .from(trustAcknowledgements)
      .where(and(eq(trustAcknowledgements.userId, userId), eq(trustAcknowledgements.mode, 'terms')));

    expect(rows).toHaveLength(0);
  });

  it('terms ack row is user-scoped (different user has no ack)', async () => {
    const emailA = `legal-user-a-${randomUUID()}@example.com`;
    const emailB = `legal-user-b-${randomUUID()}@example.com`;

    const resA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { displayName: 'User A', email: emailA, password: 'testpass12345', timezone: 'UTC', termsVersion: 'terms-v1' },
    });
    const resB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { displayName: 'User B', email: emailB, password: 'testpass12345', timezone: 'UTC' },
    });

    const userAId = JSON.parse(resA.payload).user.id;
    const userBId = JSON.parse(resB.payload).user.id;

    const rowsA = await app.db
      .select()
      .from(trustAcknowledgements)
      .where(and(eq(trustAcknowledgements.userId, userAId), eq(trustAcknowledgements.mode, 'terms')));
    const rowsB = await app.db
      .select()
      .from(trustAcknowledgements)
      .where(and(eq(trustAcknowledgements.userId, userBId), eq(trustAcknowledgements.mode, 'terms')));

    expect(rowsA).toHaveLength(1);
    expect(rowsB).toHaveLength(0);
  });
});

describe('Legal pages — hosted trust acknowledgement', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;
  let userId: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    const email = `legal-hosted-${randomUUID()}@example.com`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { displayName: 'Hosted Trust', email, password: 'testpass12345', timezone: 'UTC' },
    });
    userId = JSON.parse(regRes.payload).user.id;
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'testpass12345' },
    });
    cookies = String(loginRes.headers['set-cookie']);
  });

  afterAll(async () => {
    await app.close();
  });

  it('trust-status returns acknowledged=false before hosted trust ack', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/onboarding/trust-status',
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.acknowledged).toBe(false);
    expect(body.version).toBeDefined();
  });

  it('trust-status returns acknowledged=true after hosted trust ack', async () => {
    const csrfToken = await getCsrf(app, cookies);

    const ackRes = await app.inject({
      method: 'POST',
      url: '/api/onboarding/trust-acknowledge',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: {},
    });
    expect(ackRes.statusCode).toBe(201);

    const res = await app.inject({
      method: 'GET',
      url: '/api/onboarding/trust-status',
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.acknowledged).toBe(true);
    expect(body.acknowledgedAt).not.toBeNull();
  });
});
