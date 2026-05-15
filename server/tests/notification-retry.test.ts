/**
 * Tests for notification delivery tracking, retry/backoff, and idempotency (SaaS).
 *
 * Covers:
 *  - queued delivery is attempted on worker tick (via attemptDelivery)
 *  - retryable failure sets failed_retryable + nextAttemptAt
 *  - permanent failure sets failed_permanent (no retry)
 *  - attempt count >= 5 marks failed_permanent
 *  - idempotency key prevents duplicate send on second call
 *  - findRetryableDeliveries only returns rows past nextAttemptAt
 *  - findQueuedDeliveries returns queued rows
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/index.js';
import { notificationDeliveries } from '../src/db/schema.js';
import {
  createDelivery,
  attemptDelivery,
  findRetryableDeliveries,
  findQueuedDeliveries,
  getNextAttemptDelay,
  classifyFailure,
  type SendResult,
} from '../src/services/notification-delivery.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

let app: Awaited<ReturnType<typeof buildApp>>;

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  app = await buildApp({ testing: true });
});

afterAll(async () => {
  await app.close();
});

// ── Pure function tests ───────────────────────────────────────────────────────

describe('getNextAttemptDelay', () => {
  it('returns 0 for attempt 0 (first attempt)', () => {
    expect(getNextAttemptDelay(0)).toBe(0);
  });

  it('returns 5 minutes for attempt 1', () => {
    expect(getNextAttemptDelay(1)).toBe(5 * 60 * 1000);
  });

  it('returns 30 minutes for attempt 2', () => {
    expect(getNextAttemptDelay(2)).toBe(30 * 60 * 1000);
  });

  it('returns 2 hours for attempt 3', () => {
    expect(getNextAttemptDelay(3)).toBe(2 * 60 * 60 * 1000);
  });

  it('returns 12 hours for attempt 4', () => {
    expect(getNextAttemptDelay(4)).toBe(12 * 60 * 60 * 1000);
  });

  it('returns null for attempt 5+ (max attempts exceeded)', () => {
    expect(getNextAttemptDelay(5)).toBeNull();
    expect(getNextAttemptDelay(10)).toBeNull();
  });
});

describe('classifyFailure', () => {
  it('classifies hard_bounce as permanent', () => {
    expect(classifyFailure('hard_bounce')).toBe('permanent');
  });

  it('classifies invalid_email as permanent', () => {
    expect(classifyFailure('invalid_email')).toBe('permanent');
  });

  it('classifies unsubscribe as permanent', () => {
    expect(classifyFailure('unsubscribe')).toBe('permanent');
  });

  it('classifies spam_complaint as permanent', () => {
    expect(classifyFailure('spam_complaint')).toBe('permanent');
  });

  it('classifies invalid_telegram_chat as permanent', () => {
    expect(classifyFailure('invalid_telegram_chat')).toBe('permanent');
  });

  it('classifies null/undefined error as retryable', () => {
    expect(classifyFailure(null)).toBe('retryable');
    expect(classifyFailure(undefined)).toBe('retryable');
  });

  it('classifies network/timeout/rate_limit as retryable', () => {
    expect(classifyFailure('network_error')).toBe('retryable');
    expect(classifyFailure('timeout')).toBe('retryable');
    expect(classifyFailure('rate_limit')).toBe('retryable');
    expect(classifyFailure('server_error_500')).toBe('retryable');
  });
});

// ── Database-backed tests ─────────────────────────────────────────────────────

describe('createDelivery', () => {
  it('inserts a row with status=queued', async () => {
    const contactId = randomUUID();
    const delivery = await createDelivery(app.db, {
      contactId,
      channel: 'email',
      provider: 'postmark',
    });

    expect(delivery.id).toBeTruthy();
    expect(delivery.status).toBe('queued');
    expect(delivery.attemptCount).toBe(0);
    expect(delivery.contactId).toBe(contactId);
  });
});

describe('findQueuedDeliveries', () => {
  it('returns queued rows', async () => {
    const id1 = randomUUID();
    const id2 = randomUUID();
    await createDelivery(app.db, { contactId: id1, channel: 'email', provider: 'postmark' });
    await createDelivery(app.db, { contactId: id2, channel: 'telegram', provider: 'telegram' });

    const queued = await findQueuedDeliveries(app.db);
    expect(queued.length).toBeGreaterThanOrEqual(2);
    expect(queued.every(d => d.status === 'queued')).toBe(true);
  });
});

describe('attemptDelivery', () => {
  it('on success: sets status=sent and stores providerMessageId', async () => {
    const delivery = await createDelivery(app.db, {
      contactId: randomUUID(),
      channel: 'email',
      provider: 'postmark',
    });

    const sendFn = async (): Promise<SendResult> => ({
      ok: true,
      providerMessageId: `msg-${randomUUID()}`,
    });

    await attemptDelivery(app.db, delivery.id, sendFn);

    const [row] = await app.db
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.id, delivery.id));

    expect(row.status).toBe('sent');
    expect(row.providerMessageId).toBeTruthy();
    expect(row.attemptCount).toBe(1);
    expect(row.lastAttemptAt).not.toBeNull();
  });

  it('on retryable failure: sets status=failed_retryable and nextAttemptAt', async () => {
    const delivery = await createDelivery(app.db, {
      contactId: randomUUID(),
      channel: 'email',
      provider: 'postmark',
    });

    const sendFn = async (): Promise<SendResult> => ({
      ok: false,
      errorCode: 'connection_timeout',
      isPermanentFailure: false,
    });

    await attemptDelivery(app.db, delivery.id, sendFn);

    const [row] = await app.db
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.id, delivery.id));

    expect(row.status).toBe('failed_retryable');
    expect(row.attemptCount).toBe(1);
    expect(row.nextAttemptAt).not.toBeNull();
    expect(row.lastErrorCode).toBe('connection_timeout');
  });

  it('on permanent failure: sets status=failed_permanent', async () => {
    const delivery = await createDelivery(app.db, {
      contactId: randomUUID(),
      channel: 'email',
      provider: 'postmark',
    });

    const sendFn = async (): Promise<SendResult> => ({
      ok: false,
      errorCode: 'hard_bounce',
      isPermanentFailure: true,
    });

    await attemptDelivery(app.db, delivery.id, sendFn);

    const [row] = await app.db
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.id, delivery.id));

    expect(row.status).toBe('failed_permanent');
    expect(row.lastErrorCode).toBe('hard_bounce');
  });

  it('permanent failure via classifyFailure: marks failed_permanent without explicit flag', async () => {
    const delivery = await createDelivery(app.db, {
      contactId: randomUUID(),
      channel: 'email',
      provider: 'postmark',
    });

    const sendFn = async (): Promise<SendResult> => ({
      ok: false,
      errorCode: 'invalid_email',
      // isPermanentFailure not set — classifyFailure detects permanent
    });

    await attemptDelivery(app.db, delivery.id, sendFn);

    const [row] = await app.db
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.id, delivery.id));

    expect(row.status).toBe('failed_permanent');
  });

  it('attempt count >= 5 marks failed_permanent', async () => {
    const delivery = await createDelivery(app.db, {
      contactId: randomUUID(),
      channel: 'email',
      provider: 'postmark',
    });

    // Manually set attemptCount to 5 (max attempts exhausted)
    await app.db
      .update(notificationDeliveries)
      .set({ attemptCount: 5 })
      .where(eq(notificationDeliveries.id, delivery.id));

    const sendFn = async (): Promise<SendResult> => ({
      ok: false,
      errorCode: 'server_error_500',
      isPermanentFailure: false,
    });

    await attemptDelivery(app.db, delivery.id, sendFn);

    const [row] = await app.db
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.id, delivery.id));

    expect(row.status).toBe('failed_permanent');
    expect(row.lastErrorMessageRedacted).toBe('max_attempts_exceeded');
  });

  it('idempotency key prevents duplicate send on second call with same attempt number', async () => {
    const delivery = await createDelivery(app.db, {
      contactId: randomUUID(),
      channel: 'email',
      provider: 'postmark',
    });

    let callCount = 0;
    const sendFn = async (): Promise<SendResult> => {
      callCount += 1;
      return { ok: true, providerMessageId: `msg-dedup-${randomUUID()}` };
    };

    // First attempt
    await attemptDelivery(app.db, delivery.id, sendFn);
    expect(callCount).toBe(1);

    // Reset to queued + same attemptCount to simulate duplicate tick at same attempt
    // (idempotency key is scoped to deliveryId:attemptCount)
    await app.db
      .update(notificationDeliveries)
      .set({ status: 'queued', attemptCount: 0, providerMessageId: null })
      .where(eq(notificationDeliveries.id, delivery.id));

    // Second call with same attempt number — idempotency key already set
    await attemptDelivery(app.db, delivery.id, sendFn);
    expect(callCount).toBe(1); // sendFn should NOT be called again
  });

  it('does not retry if already in terminal state (sent)', async () => {
    const delivery = await createDelivery(app.db, {
      contactId: randomUUID(),
      channel: 'email',
      provider: 'postmark',
    });

    // Manually mark as already sent
    await app.db
      .update(notificationDeliveries)
      .set({ status: 'sent' })
      .where(eq(notificationDeliveries.id, delivery.id));

    let callCount = 0;
    const sendFn = async (): Promise<SendResult> => {
      callCount += 1;
      return { ok: true };
    };

    await attemptDelivery(app.db, delivery.id, sendFn);
    expect(callCount).toBe(0); // already terminal, skip
  });
});

describe('findRetryableDeliveries', () => {
  it('returns only rows past nextAttemptAt', async () => {
    const past = new Date(Date.now() - 1000);
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const pastContactId = randomUUID();
    const futureContactId = randomUUID();

    // Row 1: past nextAttemptAt — should be returned
    await app.db.insert(notificationDeliveries).values({
      contactId: pastContactId,
      channel: 'email',
      provider: 'postmark',
      status: 'failed_retryable',
      attemptCount: 1,
      nextAttemptAt: past,
    });

    // Row 2: future nextAttemptAt — should NOT be returned
    await app.db.insert(notificationDeliveries).values({
      contactId: futureContactId,
      channel: 'email',
      provider: 'postmark',
      status: 'failed_retryable',
      attemptCount: 1,
      nextAttemptAt: future,
    });

    const retryable = await findRetryableDeliveries(app.db, new Date());
    expect(retryable.some(r => r.contactId === pastContactId)).toBe(true);
    expect(retryable.every(r => r.status === 'failed_retryable')).toBe(true);

    // futureContactId should not appear
    expect(retryable.some(r => r.contactId === futureContactId)).toBe(false);
  });
});
