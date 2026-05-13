/**
 * relay-escrow.ts — Authenticated routes for Relay Escrow material management.
 *
 * Routes (all require auth + CSRF):
 *   GET  /api/relay/:id/escrow              — get escrow status
 *   POST /api/relay/:id/escrow/acknowledge  — record policy acknowledgement
 *   POST /api/relay/:id/escrow/enable       — upload encrypted material and enable
 *   POST /api/relay/:id/escrow/revoke       — revoke escrow material
 *
 * Security notes:
 *   - plaintext material is never stored; encrypted immediately via AES-256-GCM.
 *   - enable requires current trust_acknowledgements row (mode=relay_escrow).
 *   - audit events do not log material contents.
 */

import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { writeAuditEvent } from '../services/audit.js';
import {
  getEscrowStatus,
  acknowledgeEscrowPolicy,
  enableEscrow,
  revokeEscrow,
} from '../services/relay-escrow.js';
import { contacts, packets } from '../db/schema.js';

const ParamsSchema = z.object({ id: z.string().uuid() });

const EnableEscrowBodySchema = z.object({
  material: z.string().min(1),
  materialType: z.string().min(1).default('release_key'),
  contactIds: z.array(z.string().uuid()).min(1),
  packetId: z.string().uuid(),
});

export async function relayEscrowRoutes(app: FastifyInstance) {
  // GET /api/relay/:id/escrow
  app.get('/api/relay/:id/escrow', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const params = ParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid connection id' });

    const status = await getEscrowStatus(app.db, req.userId!, params.data.id);
    if (!status.connectionExists) return reply.status(404).send({ error: 'Not found' });

    return reply.send(status);
  });

  // POST /api/relay/:id/escrow/acknowledge
  app.post('/api/relay/:id/escrow/acknowledge', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const params = ParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid connection id' });

    const ip = req.ip ?? null;
    const userAgent = (req.headers['user-agent'] as string | undefined) ?? null;

    try {
      const result = await acknowledgeEscrowPolicy(app.db, req.userId!, params.data.id, ip, userAgent);
      await writeAuditEvent(app.db, {
        userId: req.userId,
        eventType: 'relay_escrow_policy_acknowledged',
        actorType: 'user',
        metadata: { connectionId: params.data.id, acknowledgementId: result.acknowledgementId },
      });
      return reply.status(201).send({ acknowledgementId: result.acknowledgementId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'relay_connection_not_found') return reply.status(404).send({ error: 'Not found' });
      throw err;
    }
  });

  // POST /api/relay/:id/escrow/enable
  app.post('/api/relay/:id/escrow/enable', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const params = ParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid connection id' });

    const body = EnableEscrowBodySchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', details: body.error.flatten() });

    try {
      // Verify all contactIds belong to this user
      const contactRows = await app.db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.userId, req.userId!)));
      const ownedContactIds = new Set(contactRows.map(c => c.id));
      const invalidContact = body.data.contactIds.find(id => !ownedContactIds.has(id));
      if (invalidContact) return reply.status(400).send({ error: 'Invalid contactIds', message: 'One or more contacts do not belong to this account.' });

      // Verify packetId belongs to this user
      const [packetRow] = await app.db
        .select({ id: packets.id })
        .from(packets)
        .where(and(eq(packets.id, body.data.packetId), eq(packets.userId, req.userId!)));
      if (!packetRow) return reply.status(400).send({ error: 'Invalid packetId', message: 'Packet does not belong to this account.' });

      const result = await enableEscrow(
        app.db,
        req.userId!,
        params.data.id,
        body.data.material,
        body.data.materialType,
        app.config.fieldEncryptionKey,
        body.data.contactIds,
        body.data.packetId,
      );
      await writeAuditEvent(app.db, {
        userId: req.userId,
        eventType: 'relay_escrow_enabled',
        actorType: 'user',
        metadata: { connectionId: params.data.id, escrowId: result.escrowId },
      });
      return reply.status(201).send({ escrowId: result.escrowId, enabled: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'relay_connection_not_found') return reply.status(404).send({ error: 'Not found' });
      if (msg === 'acknowledgement_required') {
        return reply.status(409).send({ error: 'acknowledgement_required', message: 'Must acknowledge Relay Escrow policy before enabling.' });
      }
      throw err;
    }
  });

  // POST /api/relay/:id/escrow/revoke
  app.post('/api/relay/:id/escrow/revoke', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const params = ParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid connection id' });

    try {
      const result = await revokeEscrow(app.db, req.userId!, params.data.id);
      await writeAuditEvent(app.db, {
        userId: req.userId,
        eventType: 'relay_escrow_revoked',
        actorType: 'user',
        metadata: { connectionId: params.data.id },
      });
      return reply.send({ revoked: result.revoked });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'relay_connection_not_found') return reply.status(404).send({ error: 'Not found' });
      throw err;
    }
  });
}
