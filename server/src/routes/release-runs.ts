/**
 * release-runs.ts — User-facing release run visibility routes.
 *
 * Routes:
 *   GET  /api/app/release-runs          — list user's release runs
 *   POST /api/app/release-runs/:id/cancel — cancel an active release run
 */

import type { FastifyInstance } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { releaseRuns, contactClaims } from '../db/schema.js';
import { writeAuditEvent } from '../services/audit.js';
import fp from 'fastify-plugin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function releaseRunPlugin(app: FastifyInstance) {
  app.get('/api/app/release-runs', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const rows = await app.db
      .select({
        id: releaseRuns.id,
        userId: releaseRuns.userId,
        source: releaseRuns.source,
        status: releaseRuns.status,
        triggeringSwitchId: releaseRuns.triggeringSwitchId,
        relayConnectionId: releaseRuns.relayConnectionId,
        startedAt: releaseRuns.startedAt,
        completedAt: releaseRuns.completedAt,
        cancelledAt: releaseRuns.cancelledAt,
        createdAt: releaseRuns.createdAt,
      })
      .from(releaseRuns)
      .where(eq(releaseRuns.userId, req.userId!))
      .orderBy(desc(releaseRuns.createdAt));

    return reply.send({ releaseRuns: rows });
  });

  // GET /api/app/release-runs/:id/cascade — cascade status for a single run
  app.get(
    '/api/app/release-runs/:id/cascade',
    { preHandler: [app.requireAuth] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      if (!UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid id' });

      const [run] = await app.db
        .select()
        .from(releaseRuns)
        .where(and(eq(releaseRuns.id, id), eq(releaseRuns.userId, req.userId!)));

      if (!run) return reply.status(404).send({ error: 'Release run not found' });

      // Return claims ordered by creation (contact priority order preserved at creation)
      const claims = await app.db
        .select({
          id: contactClaims.id,
          contactId: contactClaims.contactId,
          status: contactClaims.status,
          notifiedAt: contactClaims.notifiedAt,
          openedAt: contactClaims.openedAt,
          acceptedAt: contactClaims.acceptedAt,
          acknowledgedAt: contactClaims.acknowledgedAt,
          escalatedAt: contactClaims.escalatedAt,
          expiresAt: contactClaims.expiresAt,
        })
        .from(contactClaims)
        .where(eq(contactClaims.releaseRunId, id));

      return reply.send({
        runId: id,
        runStatus: run.status,
        currentClaimId: run.currentContactClaimId,
        claims,
      });
    },
  );

  app.post(
    '/api/app/release-runs/:id/cancel',
    { preHandler: [app.requireAuth] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      if (!UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid id' });

      const [row] = await app.db
        .select()
        .from(releaseRuns)
        .where(and(eq(releaseRuns.id, id), eq(releaseRuns.userId, req.userId!)));

      if (!row) return reply.status(404).send({ error: 'Release run not found' });
      if (['completed', 'cancelled', 'failed'].includes(row.status)) {
        return reply.status(409).send({ error: `Release run is already ${row.status}` });
      }

      await app.db
        .update(releaseRuns)
        .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
        .where(eq(releaseRuns.id, id));

      await writeAuditEvent(app.db, {
        userId: req.userId,
        eventType: 'release_run_cancelled',
        actorType: 'user',
        actorId: req.userId,
        metadata: { releaseRunId: id },
      });

      return reply.status(204).send();
    },
  );
}

export const releaseRunRoutes = fp(releaseRunPlugin, { name: 'aegis-release-runs' });
