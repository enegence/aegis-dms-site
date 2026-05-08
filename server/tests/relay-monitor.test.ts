import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/index.js';
import { relayConnections, auditEvents } from '../src/db/schema.js';
import { runRelayMonitorOnce } from '../src/services/relay-monitor.js';

async function registerAndLogin(
  app: Awaited<ReturnType<typeof buildApp>>,
  email: string,
  password = 'testpass12345',
): Promise<string> {
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { displayName: 'Monitor Test', email, password, timezone: 'UTC' },
  });
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });
  return String(loginRes.headers['set-cookie']);
}

async function getCsrf(app: Awaited<ReturnType<typeof buildApp>>, cookies: string): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/api/csrf', headers: { cookie: cookies } });
  return JSON.parse(res.payload).csrfToken;
}

async function createConnection(
  app: Awaited<ReturnType<typeof buildApp>>,
  cookies: string,
  label = 'Monitor Test Connection',
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

describe('Relay Monitor', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    cookies = await registerAndLogin(app, 'monitor@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  it('active connection with future heartbeat deadline stays active', async () => {
    const { id } = await createConnection(app, cookies, 'Future Deadline');

    // Set lastExpectedHeartbeatAt to 1 hour from now (well within grace window)
    const future = new Date(Date.now() + 60 * 60 * 1000);
    await app.db
      .update(relayConnections)
      .set({ lastExpectedHeartbeatAt: future })
      .where(eq(relayConnections.id, id));

    const result = await runRelayMonitorOnce(app.db, '', 'test@example.com');

    // Verify connection is still active
    const rows = await app.db
      .select({ status: relayConnections.status })
      .from(relayConnections)
      .where(eq(relayConnections.id, id));

    expect(rows[0].status).toBe('active');
    // The connection should not have been picked up as overdue
    expect(result.markedOffline).toBe(0);
  });

  it('overdue connection (past grace window) is marked offline', async () => {
    const { id } = await createConnection(app, cookies, 'Overdue Connection');

    // Set lastExpectedHeartbeatAt to 30 minutes ago (past 10-min grace window)
    const past = new Date(Date.now() - 30 * 60 * 1000);
    await app.db
      .update(relayConnections)
      .set({ lastExpectedHeartbeatAt: past })
      .where(eq(relayConnections.id, id));

    const result = await runRelayMonitorOnce(app.db, '', 'test@example.com');

    // Verify connection is now offline
    const rows = await app.db
      .select({ status: relayConnections.status })
      .from(relayConnections)
      .where(eq(relayConnections.id, id));

    expect(rows[0].status).toBe('offline');
    expect(result.markedOffline).toBeGreaterThanOrEqual(1);
  });

  it('alert is sent once; second run within 24h does not resend', async () => {
    const { id } = await createConnection(app, cookies, 'Alert Once Test');

    const past = new Date(Date.now() - 30 * 60 * 1000);
    await app.db
      .update(relayConnections)
      .set({ lastExpectedHeartbeatAt: past })
      .where(eq(relayConnections.id, id));

    // First run — alert should be sent
    const firstResult = await runRelayMonitorOnce(app.db, '', 'test@example.com');
    expect(firstResult.alertsSent).toBeGreaterThanOrEqual(1);

    // Confirm offlineAlertSentAt is now set
    const rows = await app.db
      .select({ offlineAlertSentAt: relayConnections.offlineAlertSentAt })
      .from(relayConnections)
      .where(eq(relayConnections.id, id));
    expect(rows[0].offlineAlertSentAt).not.toBeNull();

    // Second run — should NOT send another alert (within 24h cooldown)
    const secondResult = await runRelayMonitorOnce(app.db, '', 'test@example.com');
    expect(secondResult.alertsSent).toBe(0);
  });

  it('disconnected connection is ignored by monitor', async () => {
    const { id } = await createConnection(app, cookies, 'Disconnected Connection');

    // Set both status=disconnected and an overdue expected heartbeat
    const past = new Date(Date.now() - 30 * 60 * 1000);
    await app.db
      .update(relayConnections)
      .set({ status: 'disconnected', lastExpectedHeartbeatAt: past })
      .where(eq(relayConnections.id, id));

    // Count markedOffline before
    const resultBefore = await runRelayMonitorOnce(app.db, '', 'test@example.com');

    // Connection should still be disconnected — not changed to offline
    const rows = await app.db
      .select({ status: relayConnections.status })
      .from(relayConnections)
      .where(eq(relayConnections.id, id));

    expect(rows[0].status).toBe('disconnected');
    // markedOffline should not include this connection
    // (we can't get exact 0 due to other test data, so we just verify status unchanged)
  });

  it('connection that recovers after offline is not re-alerted', async () => {
    const { id } = await createConnection(app, cookies, 'Recovery Test');

    // Make it overdue
    const past = new Date(Date.now() - 30 * 60 * 1000);
    await app.db
      .update(relayConnections)
      .set({ lastExpectedHeartbeatAt: past })
      .where(eq(relayConnections.id, id));

    // First monitor run marks it offline
    const offlineResult = await runRelayMonitorOnce(app.db, '', 'test@example.com');
    expect(offlineResult.markedOffline).toBeGreaterThanOrEqual(1);

    // Simulate recovery: set status=active, new future deadline
    const future = new Date(Date.now() + 60 * 60 * 1000);
    await app.db
      .update(relayConnections)
      .set({
        status: 'active',
        lastHeartbeatAt: new Date(),
        lastExpectedHeartbeatAt: future,
      })
      .where(eq(relayConnections.id, id));

    // Second run should NOT mark it offline again
    await runRelayMonitorOnce(app.db, '', 'test@example.com');

    const rows = await app.db
      .select({ status: relayConnections.status })
      .from(relayConnections)
      .where(eq(relayConnections.id, id));

    expect(rows[0].status).toBe('active');
  });

  it('audit event contains no PII (no email/name fields in metadata)', async () => {
    const { id } = await createConnection(app, cookies, 'Audit PII Check');

    const past = new Date(Date.now() - 30 * 60 * 1000);
    await app.db
      .update(relayConnections)
      .set({ lastExpectedHeartbeatAt: past })
      .where(eq(relayConnections.id, id));

    await runRelayMonitorOnce(app.db, '', 'test@example.com');

    // Query audit events for relay_offline_detected related to this connection
    const events = await app.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.eventType, 'relay_offline_detected'));

    expect(events.length).toBeGreaterThanOrEqual(1);

    // Verify none of the audit events contain PII fields in metadata
    for (const event of events) {
      const meta = event.metadata as Record<string, unknown> | null;
      if (!meta) continue;

      const metaStr = JSON.stringify(meta).toLowerCase();
      expect(metaStr).not.toContain('"email"');
      expect(metaStr).not.toContain('"phone"');
      expect(metaStr).not.toContain('"fullname"');
      expect(metaStr).not.toContain('"name"');
      expect(metaStr).not.toContain('@example.com');
    }
  });
});
