import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { eq } from 'drizzle-orm';
import { getAdminMetrics } from '../services/admin-metrics.js';
import {
  users,
  relayConnections,
  releaseRuns,
  packets,
  notificationEvents,
} from '../db/schema.js';

async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await (req.server as FastifyInstance).requireAuth(req, reply);
  if (reply.sent) return;

  const [row] = await (req.server as FastifyInstance).db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, req.userId!));

  if (!row || (row.role !== 'admin' && row.role !== 'sa')) {
    return reply.status(403).send({ error: 'Admin access required' });
  }
}

async function adminPlugin(app: FastifyInstance) {
  app.get('/api/admin/metrics', { preHandler: requireAdmin }, async (_req, reply) => {
    const metrics = await getAdminMetrics(app.db);
    return reply.send(metrics);
  });

  app.get('/api/admin/users', { preHandler: requireAdmin }, async (_req, reply) => {
    const rows = await app.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        emailVerified: users.emailVerified,
        role: users.role,
        timezone: users.timezone,
        phone: users.phone,
        totpEnabled: users.totpEnabled,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users);

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
        phone: users.phone,
        totpEnabled: users.totpEnabled,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id));

    if (!row) return reply.status(404).send({ error: 'User not found' });
    return reply.send({ user: row });
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
      .from(relayConnections);

    return reply.send({ connections: rows });
  });

  app.get('/api/admin/release-runs', { preHandler: requireAdmin }, async (_req, reply) => {
    const rows = await app.db.select().from(releaseRuns);
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
      .from(packets);

    return reply.send({ packets: rows });
  });

  app.get('/api/admin/notifications', { preHandler: requireAdmin }, async (_req, reply) => {
    const rows = await app.db.select().from(notificationEvents);
    return reply.send({ events: rows });
  });
}

export const adminRoutes = fp(adminPlugin, { name: 'aegis-admin' });
