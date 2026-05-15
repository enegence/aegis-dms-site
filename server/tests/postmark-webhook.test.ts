/**
 * Tests for the Postmark inbound webhook route (SaaS only).
 *
 * POST /webhooks/postmark
 *
 * Covers:
 *  - Delivery event updates delivery to 'delivered'
 *  - HardBounce → failed_permanent
 *  - SpamComplaint → failed_permanent
 *  - SoftBounce → failed_retryable
 *  - missing/invalid token → 401
 *  - duplicate Delivery event is idempotent (second call same result, no error)
 *  - unknown event type → 200 (ignored)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/index.js';
import { notificationDeliveries } from '../src/db/schema.js';

// ── Setup ─────────────────────────────────────────────────────────────────────

let app: Awaited<ReturnType<typeof buildApp>>;

const WEBHOOK_TOKEN = 'test-postmark-webhook-token-abc123';

beforeAll(async () => {
  process.env.POSTMARK_WEBHOOK_TOKEN = WEBHOOK_TOKEN;
  app = await buildApp({ testing: true });
});

afterAll(async () => {
  delete process.env.POSTMARK_WEBHOOK_TOKEN;
  await app.close();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function insertSentDelivery(messageId: string): Promise<string> {
  const [row] = await app.db
    .insert(notificationDeliveries)
    .values({
      contactId: randomUUID(),
      channel: 'email',
      provider: 'postmark',
      status: 'sent',
      providerMessageId: messageId,
      attemptCount: 1,
    })
    .returning();
  return row.id;
}

async function getDeliveryStatus(deliveryId: string): Promise<string | null> {
  const rows = await app.db
    .select({ status: notificationDeliveries.status })
    .from(notificationDeliveries)
    .where(eq(notificationDeliveries.id, deliveryId));
  return rows[0]?.status ?? null;
}

function postWebhook(body: object, token = WEBHOOK_TOKEN) {
  return app.inject({
    method: 'POST',
    url: '/webhooks/postmark',
    payload: body,
    headers: {
      'content-type': 'application/json',
      'x-postmark-token': token,
    },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /webhooks/postmark authentication', () => {
  it('returns 401 with no token header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/postmark',
      payload: { RecordType: 'Delivery', MessageID: 'msg-no-token' },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with wrong token', async () => {
    const res = await postWebhook(
      { RecordType: 'Delivery', MessageID: 'msg-wrong-token' },
      'wrong-token-xyz',
    );
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with valid token', async () => {
    const messageId = `msg-auth-ok-${randomUUID()}`;
    const res = await postWebhook({ RecordType: 'Open', MessageID: messageId });
    expect(res.statusCode).toBe(200);
  });
});

describe('POST /webhooks/postmark — Delivery event', () => {
  it('updates delivery to status=delivered', async () => {
    const messageId = `msg-delivered-${randomUUID()}`;
    const deliveryId = await insertSentDelivery(messageId);

    const res = await postWebhook({
      RecordType: 'Delivery',
      MessageID: messageId,
      Recipient: 'contact@example.com',
      DeliveredAt: new Date().toISOString(),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.ok).toBe(true);
    expect(body.action).toBe('delivered');

    const status = await getDeliveryStatus(deliveryId);
    expect(status).toBe('delivered');
  });

  it('duplicate Delivery event is idempotent — no error, same status', async () => {
    const messageId = `msg-idem-${randomUUID()}`;
    const deliveryId = await insertSentDelivery(messageId);

    const event = {
      RecordType: 'Delivery',
      MessageID: messageId,
      DeliveredAt: new Date().toISOString(),
    };

    const res1 = await postWebhook(event);
    expect(res1.statusCode).toBe(200);

    const res2 = await postWebhook(event);
    expect(res2.statusCode).toBe(200);

    const status = await getDeliveryStatus(deliveryId);
    expect(status).toBe('delivered');
  });

  it('Delivery event for unknown MessageID returns 200 (handled=false, no error)', async () => {
    const res = await postWebhook({
      RecordType: 'Delivery',
      MessageID: `unknown-msg-${randomUUID()}`,
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('POST /webhooks/postmark — Bounce events', () => {
  it('HardBounce → failed_permanent', async () => {
    const messageId = `msg-hard-bounce-${randomUUID()}`;
    const deliveryId = await insertSentDelivery(messageId);

    const res = await postWebhook({
      RecordType: 'Bounce',
      MessageID: messageId,
      Type: 'HardBounce',
      TypeCode: 1,
      Description: 'The server was unable to deliver your message',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.action).toBe('failed_permanent');

    const status = await getDeliveryStatus(deliveryId);
    expect(status).toBe('failed_permanent');
  });

  it('Unsubscribe bounce → failed_permanent', async () => {
    const messageId = `msg-unsub-${randomUUID()}`;
    const deliveryId = await insertSentDelivery(messageId);

    const res = await postWebhook({
      RecordType: 'Bounce',
      MessageID: messageId,
      Type: 'Unsubscribe',
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).action).toBe('failed_permanent');

    const status = await getDeliveryStatus(deliveryId);
    expect(status).toBe('failed_permanent');
  });

  it('SoftBounce → failed_retryable', async () => {
    const messageId = `msg-soft-bounce-${randomUUID()}`;
    const deliveryId = await insertSentDelivery(messageId);

    const res = await postWebhook({
      RecordType: 'Bounce',
      MessageID: messageId,
      Type: 'SoftBounce',
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).action).toBe('failed_retryable');

    const status = await getDeliveryStatus(deliveryId);
    expect(status).toBe('failed_retryable');
  });

  it('duplicate HardBounce event is idempotent', async () => {
    const messageId = `msg-hard-idem-${randomUUID()}`;
    const deliveryId = await insertSentDelivery(messageId);

    const event = {
      RecordType: 'Bounce',
      MessageID: messageId,
      Type: 'HardBounce',
    };

    const res1 = await postWebhook(event);
    expect(res1.statusCode).toBe(200);

    const res2 = await postWebhook(event);
    expect(res2.statusCode).toBe(200);

    // Status should remain failed_permanent (not change on second call)
    const status = await getDeliveryStatus(deliveryId);
    expect(status).toBe('failed_permanent');
  });
});

describe('POST /webhooks/postmark — SpamComplaint event', () => {
  it('SpamComplaint → failed_permanent', async () => {
    const messageId = `msg-spam-${randomUUID()}`;
    const deliveryId = await insertSentDelivery(messageId);

    const res = await postWebhook({
      RecordType: 'SpamComplaint',
      MessageID: messageId,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.action).toBe('failed_permanent');

    const status = await getDeliveryStatus(deliveryId);
    expect(status).toBe('failed_permanent');
  });
});

describe('POST /webhooks/postmark — edge cases', () => {
  it('returns 400 for missing RecordType', async () => {
    const res = await postWebhook({ MessageID: 'msg-no-type' });
    expect(res.statusCode).toBe(400);
  });

  it('Open event returns 200 with action=logged_open', async () => {
    const res = await postWebhook({
      RecordType: 'Open',
      MessageID: `msg-open-${randomUUID()}`,
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).action).toBe('logged_open');
  });

  it('unknown RecordType returns 200 with action=ignored', async () => {
    const res = await postWebhook({
      RecordType: 'SubscriptionChange',
      MessageID: `msg-unknown-${randomUUID()}`,
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).action).toBe('ignored');
  });
});
