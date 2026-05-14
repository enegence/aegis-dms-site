import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { eq, count, inArray } from 'drizzle-orm';
import { users, releaseRuns, contactClaims, notificationDeliveries, workerHeartbeats, relayConnections } from '../db/schema.js';
import { getActiveAlerts } from '../services/alerts.js';

const APP_VERSION = '0.1.0';
const startTime = Date.now();

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

async function healthPlugin(app: FastifyInstance) {
  // ── Public health (minimal, no auth required) ─────────────────────────────
  app.get('/health', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      version: APP_VERSION,
      uptime: Math.floor((Date.now() - startTime) / 1000),
    });
  });

  // ── Detailed health (admin-only) ──────────────────────────────────────────
  app.get('/api/health/details', { preHandler: requireAdmin }, async (_req, reply) => {
    const now = new Date();

    // Database check
    let dbStatus: 'ok' | 'error' = 'ok';
    try {
      await app.db.select({ c: count() }).from(releaseRuns).limit(1);
    } catch {
      dbStatus = 'error';
    }

    // Worker heartbeat
    let workerStatus: 'ok' | 'degraded' | 'unknown' = 'unknown';
    let lastTickAt: string | null = null;
    let lastSuccessAt: string | null = null;
    let tickDurationMs: number | null = null;

    try {
      const [hb] = await app.db
        .select()
        .from(workerHeartbeats)
        .where(eq(workerHeartbeats.id, 'singleton'));

      if (hb) {
        lastTickAt = hb.lastTickAt?.toISOString() ?? null;
        lastSuccessAt = hb.lastSuccessAt?.toISOString() ?? null;
        tickDurationMs = hb.tickDurationMs ?? null;

        if (hb.lastTickAt) {
          const msSince = now.getTime() - hb.lastTickAt.getTime();
          const staleMs = parseInt(process.env.ALERT_WORKER_STALE_MINUTES ?? '10', 10) * 60 * 1000;
          workerStatus = msSince <= staleMs ? 'ok' : 'degraded';
        } else {
          workerStatus = 'unknown';
        }
      }
    } catch {
      workerStatus = 'unknown';
    }

    // Storage check — Relay/hosted storage not directly configurable per-request
    // Return 'unconfigured' unless S3 env vars are set (checked via config)
    const storageStatus: 'ok' | 'error' | 'unconfigured' =
      process.env.S3_BUCKET || process.env.AWS_S3_BUCKET ? 'ok' : 'unconfigured';

    // Notification failure counts
    let failedCount = 0;
    let retryableCount = 0;
    try {
      const [failRow] = await app.db
        .select({ c: count() })
        .from(notificationDeliveries)
        .where(eq(notificationDeliveries.status, 'failed_permanent'));
      const [retryRow] = await app.db
        .select({ c: count() })
        .from(notificationDeliveries)
        .where(eq(notificationDeliveries.status, 'failed_retryable'));
      failedCount = Number(failRow?.c ?? 0);
      retryableCount = Number(retryRow?.c ?? 0);
    } catch {
      // ignore
    }

    // Active release run count
    let activeReleaseRuns = 0;
    try {
      const [runRow] = await app.db
        .select({ c: count() })
        .from(releaseRuns)
        .where(inArray(releaseRuns.status, ['active', 'cascade_active', 'active_pending_packet']));
      activeReleaseRuns = Number(runRow?.c ?? 0);
    } catch {
      // ignore
    }

    // Pending claims count
    let pendingClaims = 0;
    try {
      const [claimRow] = await app.db
        .select({ c: count() })
        .from(contactClaims)
        .where(eq(contactClaims.status, 'pending'));
      pendingClaims = Number(claimRow?.c ?? 0);
    } catch {
      // ignore
    }

    // Alerts
    let alerts: Awaited<ReturnType<typeof getActiveAlerts>> = [];
    try {
      alerts = await getActiveAlerts(app.db);
    } catch {
      // Non-fatal
    }

    return reply.send({
      database: { status: dbStatus },
      worker: {
        status: workerStatus,
        lastTickAt,
        lastSuccessAt,
        tickDurationMs,
      },
      storage: { status: storageStatus },
      notifications: { failedCount, retryableCount },
      activeReleaseRuns,
      pendingClaims,
      alerts,
    });
  });
}

export const healthRoutes = fp(healthPlugin, { name: 'aegis-health' });
