import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { users, subscriptions } from '../db/schema.js';
import { getStripe, createCheckoutSession, createPortalSession } from '../services/stripe.js';
import { checkOrSetIdempotencyKey } from '../services/idempotency-keys.js';
import type Stripe from 'stripe';

const checkoutSchema = z.object({
  plan: z.enum(['relay', 'hosted']),
});

const portalSchema = z.object({
  returnUrl: z.string().url(),
});

export async function billingRoutes(app: FastifyInstance) {
  // Create checkout session
  app.post('/api/billing/checkout', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const body = checkoutSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid plan. Must be "relay" or "hosted".' });
    }

    const [user] = await app.db.select()
      .from(users)
      .where(eq(users.id, req.userId!));

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const [existingSub] = await app.db.select()
      .from(subscriptions)
      .where(and(
        eq(subscriptions.userId, req.userId!),
        eq(subscriptions.status, 'active'),
      ));

    if (existingSub) {
      return reply.status(409).send({ error: 'Active subscription already exists. Use portal to manage.' });
    }

    const stripe = getStripe(app.config.stripe.secretKey);
    const priceId = body.data.plan === 'relay'
      ? app.config.stripe.relayPriceId
      : app.config.stripe.hostedPriceId;

    if (!priceId) {
      return reply.status(500).send({ error: 'Stripe price not configured for this plan' });
    }

    const url = await createCheckoutSession(stripe, {
      customerEmail: user.email,
      priceId,
      successUrl: `${app.config.baseUrl}/billing?success=true`,
      cancelUrl: `${app.config.baseUrl}/billing?cancelled=true`,
      metadata: {
        userId: user.id,
        plan: body.data.plan,
      },
    });

    return reply.send({ url });
  });

  // Customer portal
  app.post('/api/billing/portal', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const body = portalSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid request. returnUrl must be a valid URL.' });
    }

    const [sub] = await app.db.select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, req.userId!));

    if (!sub || !sub.stripeCustomerId) {
      return reply.status(400).send({ error: 'No billing account found' });
    }

    const stripe = getStripe(app.config.stripe.secretKey);
    const url = await createPortalSession(
      stripe,
      sub.stripeCustomerId,
      body.data.returnUrl,
    );

    return reply.send({ url });
  });

  // Billing summary
  app.get('/api/billing/summary', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const allSubs = await app.db.select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, req.userId!));

    const customerId = allSubs.length > 0 ? allSubs[0].stripeCustomerId : null;

    const subList = allSubs.map(sub => ({
      id: sub.id,
      plan: sub.plan as 'relay' | 'hosted',
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      cancelledAt: sub.cancelledAt?.toISOString() ?? null,
    }));

    const hasRelay = allSubs.some(s => s.plan === 'relay' && s.status === 'active');
    const hasHosted = allSubs.some(s => s.plan === 'hosted' && s.status === 'active');

    return reply.send({
      customerId,
      subscriptions: subList,
      hasRelay,
      hasHosted,
      pricingUrl: '/pricing',
    });
  });

  // Get current subscription
  app.get('/api/billing/subscription', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const [sub] = await app.db.select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, req.userId!));

    if (!sub) {
      return reply.send({ subscription: null });
    }

    return reply.send({
      subscription: {
        id: sub.id,
        plan: sub.plan,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
        cancelledAt: sub.cancelledAt?.toISOString() ?? null,
      },
    });
  });

  // Stripe webhook
  app.post('/api/billing/webhook', async (req, reply) => {
    const sig = req.headers['stripe-signature'];
    const isTestBypass = app.config.testing && req.headers['x-stripe-test-bypass'] === '1';

    let event: Stripe.Event;

    if (isTestBypass) {
      // In test mode, parse the raw body directly without signature verification
      try {
        event = JSON.parse((req as any).rawBody as string) as Stripe.Event;
      } catch {
        return reply.status(400).send({ error: 'Invalid JSON' });
      }
    } else {
      if (!sig || !app.config.stripe.webhookSecret) {
        return reply.status(400).send({ error: 'Missing signature or webhook secret' });
      }

      const stripe = getStripe(app.config.stripe.secretKey);
      try {
        event = stripe.webhooks.constructEvent(
          (req as any).rawBody as string,
          sig as string,
          app.config.stripe.webhookSecret,
        );
      } catch {
        return reply.status(400).send({ error: 'Invalid signature' });
      }
    }

    // Idempotency check using idempotency_keys table
    const idemKey = `stripe_webhook:${event.id}`;
    const idem = await checkOrSetIdempotencyKey(app.db, idemKey, 'stripe_webhook');
    if (idem.found) {
      return reply.send({ received: true });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;

        if (userId && plan && session.subscription && session.customer) {
          await app.db.insert(subscriptions).values({
            userId,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            plan,
            status: 'active',
          });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const newStatus = sub.status === 'active' ? 'active'
          : sub.status === 'past_due' ? 'past_due'
          : sub.status === 'canceled' ? 'cancelled'
          : sub.status === 'trialing' ? 'trialing'
          : sub.status === 'paused' ? 'paused'
          : 'active';

        const updateFields: Record<string, unknown> = {
          status: newStatus,
          updatedAt: new Date(),
        };

        if ((sub as any).current_period_end) {
          updateFields.currentPeriodEnd = new Date((sub as any).current_period_end * 1000);
        }

        await app.db.update(subscriptions)
          .set(updateFields as Parameters<ReturnType<typeof app.db.update>['set']>[0])
          .where(eq(subscriptions.stripeSubscriptionId, sub.id));
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await app.db.update(subscriptions)
          .set({
            status: 'cancelled',
            cancelledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.stripeSubscriptionId, sub.id));
        break;
      }

      case 'customer.subscription.paused': {
        const sub = event.data.object as Stripe.Subscription;
        await app.db.update(subscriptions)
          .set({
            status: 'paused',
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.stripeSubscriptionId, sub.id));
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await app.db.update(subscriptions)
            .set({
              status: 'active',
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.stripeSubscriptionId, invoice.subscription as string));
        }
        break;
      }

      case 'invoice.payment_failed':
      case 'invoice.payment_action_required': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await app.db.update(subscriptions)
            .set({
              status: 'past_due',
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.stripeSubscriptionId, invoice.subscription as string));
        }
        break;
      }

      case 'customer.deleted': {
        const customer = event.data.object as Stripe.Customer;
        await app.db.update(subscriptions)
          .set({
            status: 'cancelled',
            cancelledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.stripeCustomerId, customer.id));
        break;
      }
    }

    return reply.send({ received: true });
  });
}
