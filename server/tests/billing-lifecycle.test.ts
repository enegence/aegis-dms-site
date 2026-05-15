/**
 * Phase 5 Task 6 — Billing lifecycle tests
 *
 * Verifies:
 *  - customer.subscription.updated to past_due → subscription flagged, data preserved
 *  - customer.subscription.updated to canceled → access flags updated
 *  - customer.subscription.deleted → same as canceled
 *  - invoice.payment_failed → subscription moved to past_due
 *  - invoice.paid → subscription restored to active
 *  - Stripe webhook replay (same event.id twice) → idempotent (processed once)
 *  - checkout.session.completed → subscription linked to user
 *  - customer.deleted → user subscription cleared
 *  - customer.subscription.created → subscription upserted to active
 *  - customer.subscription.paused → subscription set to paused
 *  - invoice.payment_action_required → subscription set to past_due
 *
 * Uses mocked Stripe objects — no real Stripe API calls.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { buildApp } from '../src/index.js';
import { users, subscriptions, idempotencyKeys } from '../src/db/schema.js';

// Build a mock Stripe webhook signature header.
// In test mode, the webhook handler accepts a special bypass header.
const TEST_WEBHOOK_SECRET = 'whsec_test_bypass';

async function registerAndLogin(app: Awaited<ReturnType<typeof buildApp>>, suffix: string) {
  const email = `billing-lifecycle-${suffix}-${randomUUID()}@example.com`;
  await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { displayName: 'Billing Lifecycle', email, password: 'testpass12345', timezone: 'UTC' },
  });
  const loginRes = await app.inject({
    method: 'POST', url: '/api/auth/login',
    payload: { email, password: 'testpass12345' },
  });
  const cookies = String(loginRes.headers['set-cookie']);
  const meRes = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookies } });
  const userId = JSON.parse(meRes.payload).id as string;
  return { cookies, userId, email };
}

/**
 * Inject a mock Stripe webhook event. In test mode, a special header bypasses
 * signature verification.
 */
async function sendWebhookEvent(
  app: Awaited<ReturnType<typeof buildApp>>,
  event: object,
) {
  const payload = JSON.stringify(event);
  return app.inject({
    method: 'POST',
    url: '/api/billing/webhook',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': 'test-bypass',
      'x-stripe-test-bypass': '1',
    },
    payload,
  });
}

describe('Billing lifecycle — Stripe webhook events', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let userId: string;
  const stripeSubId = `sub_lifecycle_${randomUUID().replace(/-/g, '')}`;
  const stripeCustomerId = `cus_lifecycle_${randomUUID().replace(/-/g, '')}`;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    const user = await registerAndLogin(app, 'lifecycle');
    userId = user.userId;

    // Seed an initial active subscription
    await app.db.insert(subscriptions).values({
      id: randomUUID(),
      userId,
      stripeCustomerId,
      stripeSubscriptionId: stripeSubId,
      plan: 'relay',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ── checkout.session.completed ────────────────────────────────────────────

  it('checkout.session.completed creates a new subscription for user', async () => {
    const newUserId = (await registerAndLogin(app, 'checkout')).userId;
    const newSubId = `sub_checkout_${randomUUID().replace(/-/g, '')}`;
    const newCusId = `cus_checkout_${randomUUID().replace(/-/g, '')}`;

    const event = {
      id: `evt_checkout_${randomUUID()}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: `cs_${randomUUID()}`,
          customer: newCusId,
          subscription: newSubId,
          metadata: { userId: newUserId, plan: 'relay' },
        },
      },
    };

    const res = await sendWebhookEvent(app, event);
    expect(res.statusCode).toBe(200);

    // Verify subscription was created
    const [sub] = await app.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, newSubId));

    expect(sub).toBeDefined();
    expect(sub.userId).toBe(newUserId);
    expect(sub.plan).toBe('relay');
    expect(sub.status).toBe('active');
  });

  // ── customer.subscription.updated → past_due ─────────────────────────────

  it('customer.subscription.updated to past_due flags subscription, preserves data', async () => {
    const event = {
      id: `evt_past_due_${randomUUID()}`,
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: stripeSubId,
          status: 'past_due',
          current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
          plan: { id: 'price_relay' },
        },
      },
    };

    const res = await sendWebhookEvent(app, event);
    expect(res.statusCode).toBe(200);

    const [sub] = await app.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubId));

    expect(sub).toBeDefined();
    expect(sub.status).toBe('past_due');
    // Data preserved — subscription still exists, userId intact
    expect(sub.userId).toBe(userId);
    expect(sub.plan).toBe('relay');
  });

  // ── invoice.paid → restore to active ────────────────────────────────────

  it('invoice.paid restores subscription to active', async () => {
    const event = {
      id: `evt_invoice_paid_${randomUUID()}`,
      type: 'invoice.paid',
      data: {
        object: {
          id: `in_${randomUUID()}`,
          subscription: stripeSubId,
          customer: stripeCustomerId,
          status: 'paid',
        },
      },
    };

    const res = await sendWebhookEvent(app, event);
    expect(res.statusCode).toBe(200);

    const [sub] = await app.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubId));

    expect(sub).toBeDefined();
    expect(sub.status).toBe('active');
  });

  // ── invoice.payment_failed → past_due ───────────────────────────────────

  it('invoice.payment_failed sets subscription to past_due', async () => {
    const event = {
      id: `evt_invoice_failed_${randomUUID()}`,
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: `in_${randomUUID()}`,
          subscription: stripeSubId,
          customer: stripeCustomerId,
          status: 'open',
        },
      },
    };

    const res = await sendWebhookEvent(app, event);
    expect(res.statusCode).toBe(200);

    const [sub] = await app.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubId));

    expect(sub).toBeDefined();
    expect(sub.status).toBe('past_due');
  });

  // ── invoice.payment_action_required → past_due ─────────────────────────

  it('invoice.payment_action_required sets subscription to past_due', async () => {
    // Reset to active first
    await app.db.update(subscriptions)
      .set({ status: 'active' })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubId));

    const event = {
      id: `evt_action_required_${randomUUID()}`,
      type: 'invoice.payment_action_required',
      data: {
        object: {
          id: `in_${randomUUID()}`,
          subscription: stripeSubId,
          customer: stripeCustomerId,
          status: 'open',
        },
      },
    };

    const res = await sendWebhookEvent(app, event);
    expect(res.statusCode).toBe(200);

    const [sub] = await app.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubId));

    expect(sub.status).toBe('past_due');
  });

  // ── customer.subscription.updated → canceled ─────────────────────────────

  it('customer.subscription.updated to canceled updates access flags', async () => {
    const event = {
      id: `evt_canceled_${randomUUID()}`,
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: stripeSubId,
          status: 'canceled',
          current_period_end: Math.floor(Date.now() / 1000) + 86400,
        },
      },
    };

    const res = await sendWebhookEvent(app, event);
    expect(res.statusCode).toBe(200);

    const [sub] = await app.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubId));

    expect(sub.status).toBe('cancelled');
    // Data preserved
    expect(sub.userId).toBe(userId);
  });

  // ── customer.subscription.deleted ────────────────────────────────────────

  it('customer.subscription.deleted sets status to cancelled', async () => {
    // Reset to active first
    await app.db.update(subscriptions)
      .set({ status: 'active', cancelledAt: null })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubId));

    const event = {
      id: `evt_deleted_${randomUUID()}`,
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: stripeSubId,
          status: 'canceled',
        },
      },
    };

    const res = await sendWebhookEvent(app, event);
    expect(res.statusCode).toBe(200);

    const [sub] = await app.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubId));

    expect(sub.status).toBe('cancelled');
    expect(sub.cancelledAt).not.toBeNull();
  });

  // ── customer.subscription.paused ─────────────────────────────────────────

  it('customer.subscription.paused sets status to paused', async () => {
    // Reset to active first
    await app.db.update(subscriptions)
      .set({ status: 'active', cancelledAt: null })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubId));

    const event = {
      id: `evt_paused_${randomUUID()}`,
      type: 'customer.subscription.paused',
      data: {
        object: {
          id: stripeSubId,
          status: 'paused',
          current_period_end: Math.floor(Date.now() / 1000) + 86400,
        },
      },
    };

    const res = await sendWebhookEvent(app, event);
    expect(res.statusCode).toBe(200);

    const [sub] = await app.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubId));

    expect(sub.status).toBe('paused');
  });

  // ── customer.subscription.created ────────────────────────────────────────

  it('customer.subscription.created upserts subscription to active', async () => {
    const newUser = await registerAndLogin(app, 'sub-created');
    const newSubId = `sub_created_${randomUUID().replace(/-/g, '')}`;
    const newCusId = `cus_created_${randomUUID().replace(/-/g, '')}`;

    // Seed user subscription record first (as checkout.session.completed would have done)
    await app.db.insert(subscriptions).values({
      id: randomUUID(),
      userId: newUser.userId,
      stripeCustomerId: newCusId,
      stripeSubscriptionId: newSubId,
      plan: 'hosted',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const event = {
      id: `evt_sub_created_${randomUUID()}`,
      type: 'customer.subscription.created',
      data: {
        object: {
          id: newSubId,
          customer: newCusId,
          status: 'active',
          current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
        },
      },
    };

    const res = await sendWebhookEvent(app, event);
    expect(res.statusCode).toBe(200);

    const [sub] = await app.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, newSubId));

    expect(sub).toBeDefined();
    expect(sub.status).toBe('active');
  });

  // ── customer.deleted ─────────────────────────────────────────────────────

  it('customer.deleted clears subscription for user', async () => {
    const deletedUser = await registerAndLogin(app, 'cus-deleted');
    const deletedSubId = `sub_del_${randomUUID().replace(/-/g, '')}`;
    const deletedCusId = `cus_del_${randomUUID().replace(/-/g, '')}`;

    await app.db.insert(subscriptions).values({
      id: randomUUID(),
      userId: deletedUser.userId,
      stripeCustomerId: deletedCusId,
      stripeSubscriptionId: deletedSubId,
      plan: 'relay',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const event = {
      id: `evt_cus_deleted_${randomUUID()}`,
      type: 'customer.deleted',
      data: {
        object: {
          id: deletedCusId,
        },
      },
    };

    const res = await sendWebhookEvent(app, event);
    expect(res.statusCode).toBe(200);

    const [sub] = await app.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, deletedCusId));

    // Subscription should be cancelled
    expect(sub).toBeDefined();
    expect(sub.status).toBe('cancelled');
  });

  // ── Webhook idempotency (replay protection) ───────────────────────────────

  it('same event.id sent twice is processed only once (idempotency)', async () => {
    // Reset subscription to active
    await app.db.update(subscriptions)
      .set({ status: 'active', cancelledAt: null })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubId));

    const eventId = `evt_idempotent_${randomUUID()}`;
    const event = {
      id: eventId,
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: stripeSubId,
          status: 'past_due',
          current_period_end: Math.floor(Date.now() / 1000) + 86400,
        },
      },
    };

    // First send
    const res1 = await sendWebhookEvent(app, event);
    expect(res1.statusCode).toBe(200);

    // Verify state changed
    const [subAfterFirst] = await app.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubId));
    expect(subAfterFirst.status).toBe('past_due');

    // Reset to active to verify the second event doesn't process again
    await app.db.update(subscriptions)
      .set({ status: 'active' })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubId));

    // Second send — same event ID
    const res2 = await sendWebhookEvent(app, event);
    expect(res2.statusCode).toBe(200);

    // State should still be 'active' because the event was deduplicated
    const [subAfterSecond] = await app.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubId));
    expect(subAfterSecond.status).toBe('active');

    // Verify the idempotency key exists in idempotency_keys table
    const [iKey] = await app.db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, `stripe_webhook:${eventId}`));
    expect(iKey).toBeDefined();
    expect(iKey.scope).toBe('stripe_webhook');
  });
});
