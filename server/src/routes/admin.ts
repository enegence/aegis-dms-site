import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { eq, desc, and, count, sql } from 'drizzle-orm';
import { getAdminMetrics } from '../services/admin-metrics.js';
import { writeAuditEvent } from '../services/audit.js';
import {
  users,
  subscriptions,
  relayConnections,
  releaseRuns,
  packets,
  notificationEvents,
  switches,
} from '../db/schema.js';

async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await (req.server as FastifyInstance).requireAuth(req, reply);
  if (reply.sent) return;

  const [row] = await (req.server as FastifyInstance).db
    .select({ role: users.role, email: users.email })
    .from(users)
    .where(eq(users.id, req.userId!));

  if (!row) {
    return reply.status(403).send({ error: 'Admin access required' });
  }

  const isRoleAdmin = row.role === 'admin' || row.role === 'sa';
  const adminEmails = (req.server as FastifyInstance).config.adminEmails;
  const isEmailAdmin = adminEmails.length > 0 && adminEmails.includes(row.email.toLowerCase());

  if (!isRoleAdmin && !isEmailAdmin) {
    return reply.status(403).send({ error: 'Admin access required' });
  }
}

async function adminPlugin(app: FastifyInstance) {
  app.get('/api/admin/metrics', { preHandler: requireAdmin }, async (req, reply) => {
    const metrics = await getAdminMetrics(app.db);
    await writeAuditEvent(app.db, {
      userId: req.userId,
      eventType: 'admin_viewed_metrics',
      actorType: 'user',
      actorId: req.userId,
      metadata: {},
    });
    return reply.send(metrics);
  });

  // Redacted: no phone, no passwordHash, no tokens, no totpSecret
  app.get('/api/admin/users', { preHandler: requireAdmin }, async (_req, reply) => {
    const rows = await app.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        emailVerified: users.emailVerified,
        role: users.role,
        timezone: users.timezone,
        totpEnabled: users.totpEnabled,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return reply.send({ users: rows });
  });

  app.get('/api/admin/users/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const [row] = await app.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        emailVerified: users.emailVerified,
        role: users.role,
        timezone: users.timezone,
        totpEnabled: users.totpEnabled,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id));

    if (!row) return reply.status(404).send({ error: 'User not found' });

    // Subscription summary (no Stripe IDs)
    const [sub] = await app.db
      .select({
        plan: subscriptions.plan,
        status: subscriptions.status,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        cancelledAt: subscriptions.cancelledAt,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, id))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    // Relay connection count
    const [relayRow] = await app.db
      .select({ cnt: count() })
      .from(relayConnections)
      .where(eq(relayConnections.userId, id));

    // Active release run count
    const [rrRow] = await app.db
      .select({ cnt: count() })
      .from(releaseRuns)
      .where(and(
        eq(releaseRuns.userId, id),
        eq(releaseRuns.status, 'active'),
      ));

    // Failed notification count
    const [notifRow] = await app.db
      .select({ cnt: count() })
      .from(notificationEvents)
      .where(and(
        eq(notificationEvents.userId, id),
        sql`${notificationEvents.status} IN ('failed', 'failed_permanent', 'failed_retryable')`,
      ));

    // Hosted switch count
    const [switchRow] = await app.db
      .select({ cnt: count() })
      .from(switches)
      .where(eq(switches.userId, id));

    return reply.send({
      user: {
        ...row,
        subscriptionStatus: sub?.status ?? null,
        subscriptionPlan: sub?.plan ?? null,
        subscriptionCurrentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
        relayConnectionCount: relayRow?.cnt ?? 0,
        activeReleaseRunCount: rrRow?.cnt ?? 0,
        failedNotificationCount: notifRow?.cnt ?? 0,
        hostedSwitchCount: switchRow?.cnt ?? 0,
      },
    });
  });

  app.get('/api/admin/relay-connections', { preHandler: requireAdmin }, async (_req, reply) => {
    const rows = await app.db
      .select({
        id: relayConnections.id,
        userId: relayConnections.userId,
        label: relayConnections.label,
        mode: relayConnections.mode,
        status: relayConnections.status,
        lastHeartbeatAt: relayConnections.lastHeartbeatAt,
        offlineAlertSentAt: relayConnections.offlineAlertSentAt,
        revokedAt: relayConnections.revokedAt,
        createdAt: relayConnections.createdAt,
        updatedAt: relayConnections.updatedAt,
      })
      .from(relayConnections)
      .orderBy(desc(relayConnections.createdAt));

    return reply.send({ connections: rows });
  });

  app.get('/api/admin/release-runs', { preHandler: requireAdmin }, async (_req, reply) => {
    const rows = await app.db
      .select({
        id: releaseRuns.id,
        userId: releaseRuns.userId,
        source: releaseRuns.source,
        status: releaseRuns.status,
        startedAt: releaseRuns.startedAt,
        completedAt: releaseRuns.completedAt,
        cancelledAt: releaseRuns.cancelledAt,
        createdAt: releaseRuns.createdAt,
      })
      .from(releaseRuns)
      .orderBy(desc(releaseRuns.createdAt));
    return reply.send({ releaseRuns: rows });
  });

  app.get('/api/admin/packets', { preHandler: requireAdmin }, async (_req, reply) => {
    const rows = await app.db
      .select({
        id: packets.id,
        userId: packets.userId,
        switchId: packets.switchId,
        releaseRunId: packets.releaseRunId,
        relayConnectionId: packets.relayConnectionId,
        sourceApp: packets.sourceApp,
        schemaVersion: packets.schemaVersion,
        version: packets.version,
        encryptionAlgorithm: packets.encryptionAlgorithm,
        keyId: packets.keyId,
        contentHash: packets.contentHash,
        storageProvider: packets.storageProvider,
        storageBucket: packets.storageBucket,
        deletionStatus: packets.deletionStatus,
        lastVerifiedAt: packets.lastVerifiedAt,
        expiresAt: packets.expiresAt,
        createdAt: packets.createdAt,
      })
      .from(packets)
      .orderBy(desc(packets.createdAt));

    return reply.send({ packets: rows });
  });

  app.get('/api/admin/notifications', { preHandler: requireAdmin }, async (_req, reply) => {
    const rows = await app.db
      .select()
      .from(notificationEvents)
      .orderBy(desc(notificationEvents.createdAt));
    return reply.send({ events: rows });
  });

  // Subscriptions: no Stripe secrets (no stripeCustomerId, no stripeSubscriptionId)
  app.get('/api/admin/subscriptions', { preHandler: requireAdmin }, async (_req, reply) => {
    const rows = await app.db
      .select({
        id: subscriptions.id,
        userId: subscriptions.userId,
        email: users.email,
        plan: subscriptions.plan,
        status: subscriptions.status,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        cancelledAt: subscriptions.cancelledAt,
        createdAt: subscriptions.createdAt,
        updatedAt: subscriptions.updatedAt,
      })
      .from(subscriptions)
      .innerJoin(users, eq(subscriptions.userId, users.id))
      .orderBy(desc(subscriptions.createdAt));

    return reply.send({ subscriptions: rows });
  });

  // System health: DB connectivity + uptime
  app.get('/api/admin/system-health', { preHandler: requireAdmin }, async (_req, reply) => {
    let dbConnected = false;
    try {
      await app.db.select({ c: eq(users.id, users.id) }).from(users).limit(1);
      dbConnected = true;
    } catch {
      dbConnected = false;
    }

    const status = dbConnected ? 'ok' : 'degraded';
    return reply.send({
      status,
      dbConnected,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });
}

export const adminRoutes = fp(adminPlugin, { name: 'aegis-admin' });
