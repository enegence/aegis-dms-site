import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { createHash } from 'crypto';
import { userOnboarding, subscriptions, trustAcknowledgements } from '../db/schema.js';
import { writeAuditEvent } from '../services/audit.js';

const HOSTED_TRUST_VERSION = 'hosted-v1';

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const VALID_PRODUCTS = ['relay', 'hosted', 'undecided'] as const;
type PreferredProduct = typeof VALID_PRODUCTS[number];

const preferredProductSchema = z.object({
  preferredProduct: z.enum(VALID_PRODUCTS),
});

const completeStepSchema = z.object({
  step: z.string().min(1).max(100),
});

/**
 * Resolve the recommended next route based on the user's active subscriptions.
 *
 * No active subscription  → /app/billing  (prompt user to subscribe)
 * Active relay only       → /relay    (relay setup checklist)
 * Active hosted only      → /dashboard (hosted setup — dashboard is entry point)
 * Both active             → /dashboard (let user choose; dashboard shows both surfaces)
 */
function resolveNextRoute(
  activePlans: Array<{ plan: string; status: string }>,
): string {
  const hasRelay = activePlans.some(s => s.plan === 'relay' && s.status === 'active');
  const hasHosted = activePlans.some(s => s.plan === 'hosted' && s.status === 'active');

  if (!hasRelay && !hasHosted) return '/app/billing';
  if (hasRelay && !hasHosted) return '/relay';
  // hosted (alone or both) → dashboard
  return '/dashboard';
}

/**
 * Fetch or create the onboarding record for the given userId.
 * New users automatically get an onboarding row on first GET.
 */
async function getOrCreateOnboarding(
  db: FastifyInstance['db'],
  userId: string,
) {
  await db
    .insert(userOnboarding)
    .values({ userId })
    .onConflictDoNothing();

  const [row] = await db
    .select()
    .from(userOnboarding)
    .where(eq(userOnboarding.userId, userId));

  return row;
}

export async function onboardingRoutes(app: FastifyInstance) {
  // ── GET /api/onboarding ─────────────────────────────────────────────────────
  // Returns current onboarding state + subscription summary + recommended next route.
  app.get('/api/onboarding', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const userId = req.userId!;

    const [onboarding, activeSubs] = await Promise.all([
      getOrCreateOnboarding(app.db, userId),
      app.db
        .select({ plan: subscriptions.plan, status: subscriptions.status })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.status, 'active'),
          ),
        ),
    ]);

    // For subscription summary we expose only plan+status (no payment secrets).
    // Use first active sub for the primary plan display; null if none.
    const primarySub = activeSubs[0] ?? null;

    return reply.send({
      preferredProduct: onboarding.preferredProduct as PreferredProduct,
      currentStep: onboarding.currentStep,
      completedAt: onboarding.completedAt?.toISOString() ?? null,
      subscription: {
        plan: primarySub?.plan ?? null,
        status: primarySub?.status ?? null,
        hasRelay: activeSubs.some(s => s.plan === 'relay'),
        hasHosted: activeSubs.some(s => s.plan === 'hosted'),
      },
      nextRoute: resolveNextRoute(activeSubs),
    });
  });

  // ── PUT /api/onboarding/preferred-product ───────────────────────────────────
  // Sets the user's preferred product surface (relay | hosted | undecided).
  // Auth + CSRF required.
  app.put('/api/onboarding/preferred-product', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const body = preferredProductSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid preferredProduct. Must be "relay", "hosted", or "undecided".' });
    }

    const userId = req.userId!;
    const { preferredProduct } = body.data;

    // Upsert — create if not exists, update if exists
    await getOrCreateOnboarding(app.db, userId);

    const [updated] = await app.db
      .update(userOnboarding)
      .set({ preferredProduct, updatedAt: new Date() })
      .where(eq(userOnboarding.userId, userId))
      .returning();

    await writeAuditEvent(app.db, {
      userId,
      eventType: 'onboarding_preferred_product_set',
      actorType: 'user',
      actorId: userId,
      metadata: { preferredProduct },
    });

    return reply.send({
      preferredProduct: updated.preferredProduct as PreferredProduct,
      currentStep: updated.currentStep,
    });
  });

  // ── POST /api/onboarding/complete-step ─────────────────────────────────────
  // Records that the user has reached a named onboarding step.
  // Auth + CSRF required.
  app.post('/api/onboarding/complete-step', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const body = completeStepSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid step. Must be a non-empty string (max 100 chars).' });
    }

    const userId = req.userId!;
    const { step } = body.data;

    await getOrCreateOnboarding(app.db, userId);

    const [updated] = await app.db
      .update(userOnboarding)
      .set({ currentStep: step, updatedAt: new Date() })
      .where(eq(userOnboarding.userId, userId))
      .returning();

    await writeAuditEvent(app.db, {
      userId,
      eventType: 'onboarding_step_completed',
      actorType: 'user',
      actorId: userId,
      metadata: { step },
    });

    return reply.send({
      currentStep: updated.currentStep,
      completedAt: updated.completedAt?.toISOString() ?? null,
    });
  });

  // ── POST /api/onboarding/complete ──────────────────────────────────────────
  // Marks onboarding fully complete. Sets completedAt timestamp.
  // Auth + CSRF required.
  app.post('/api/onboarding/complete', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const userId = req.userId!;

    await getOrCreateOnboarding(app.db, userId);

    const now = new Date();
    const [updated] = await app.db
      .update(userOnboarding)
      .set({ completedAt: now, currentStep: 'complete', updatedAt: now })
      .where(eq(userOnboarding.userId, userId))
      .returning();

    await writeAuditEvent(app.db, {
      userId,
      eventType: 'onboarding_completed',
      actorType: 'user',
      actorId: userId,
      metadata: {},
    });

    return reply.send({
      completedAt: updated.completedAt?.toISOString() ?? null,
      currentStep: updated.currentStep,
    });
  });

  // ── POST /api/onboarding/trust-acknowledge ──────────────────────────────────
  // Records that the user has accepted the Hosted trust model (version hosted-v1).
  // Inserts a row into trust_acknowledgements with mode='hosted', version='hosted-v1'.
  // Auth + CSRF required.
  app.post('/api/onboarding/trust-acknowledge', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const userId = req.userId!;

    const ip = req.ip ?? null;
    const userAgent = (req.headers['user-agent'] as string | undefined) ?? null;

    const [row] = await app.db
      .insert(trustAcknowledgements)
      .values({
        userId,
        mode: 'hosted',
        version: HOSTED_TRUST_VERSION,
        ipHash: ip ? hashValue(ip) : null,
        userAgentHash: userAgent ? hashValue(userAgent) : null,
      })
      .returning();

    await writeAuditEvent(app.db, {
      userId,
      eventType: 'onboarding_hosted_trust_acknowledged',
      actorType: 'user',
      actorId: userId,
      metadata: { version: HOSTED_TRUST_VERSION, acknowledgementId: row.id },
    });

    return reply.status(201).send({ acknowledgementId: row.id, version: HOSTED_TRUST_VERSION });
  });

  // ── GET /api/onboarding/trust-status ───────────────────────────────────────
  // Returns whether the user has an active hosted trust acknowledgement.
  // Auth required.
  app.get('/api/onboarding/trust-status', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const userId = req.userId!;

    const rows = await app.db
      .select({ id: trustAcknowledgements.id, acceptedAt: trustAcknowledgements.acceptedAt })
      .from(trustAcknowledgements)
      .where(
        and(
          eq(trustAcknowledgements.userId, userId),
          eq(trustAcknowledgements.mode, 'hosted'),
          eq(trustAcknowledgements.version, HOSTED_TRUST_VERSION),
        ),
      );

    const acknowledged = rows.length > 0;
    const latestRow = rows[rows.length - 1] ?? null;

    return reply.send({
      acknowledged,
      version: HOSTED_TRUST_VERSION,
      acknowledgedAt: latestRow?.acceptedAt?.toISOString() ?? null,
    });
  });
}
