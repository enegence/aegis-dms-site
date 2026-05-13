/**
 * packets.ts — Hosted packet management routes.
 *
 * Routes:
 *   GET    /api/app/packets                          — list user's packets (metadata only)
 *   GET    /api/app/packets/:id                      — get single packet metadata
 *   POST   /api/app/switches/:id/packets/generate    — generate packet for switch
 *   POST   /api/app/packets/:id/verify               — verify packet exists in storage
 *   DELETE /api/app/packets/:id                      — delete packet (mark + remove from storage)
 *
 * Security notes:
 *   - All routes require auth (requireAuth preHandler)
 *   - State-changing routes (POST, DELETE) are covered by the global CSRF hook in index.ts
 *   - Packet generation requires hosted subscription (canUseHosted)
 *   - All queries filter by userId to enforce ownership isolation
 *   - Encrypted packet data is NEVER returned in responses
 */

import { randomUUID } from 'crypto';
import type { FastifyInstance } from 'fastify';
import {
  createPacket as _createPacket,
  getPacketById,
  listPackets,
  updatePacketStorage,
  type PacketRow,
} from '../repositories/packet-repository.js';
import { buildHostedPacket } from '../services/hosted-packet-builder.js';
import { verifyManagedPacket, deleteManagedPacket } from '../services/storage/index.js';
import { canUseHosted } from '../services/subscription-gate.js';
import { writeAuditEvent } from '../services/audit.js';

// ── UUID validation ────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

// ── Response shaping — metadata only, no encrypted data ───────────────────────

function toPacketMetadata(row: PacketRow) {
  return {
    id: row.id,
    userId: row.userId,
    switchId: row.switchId,
    releaseRunId: row.releaseRunId,
    sourceApp: row.sourceApp,
    schemaVersion: row.schemaVersion,
    version: row.version,
    encryptionAlgorithm: row.encryptionAlgorithm,
    keyId: row.keyId,
    contentHash: row.contentHash,
    encryptedObjectHash: row.encryptedObjectHash,
    storageProvider: row.storageProvider,
    storageBucket: row.storageBucket,
    storageObjectKey: row.storageObjectKey,
    storageRegion: row.storageRegion,
    lastVerifiedAt: row.lastVerifiedAt ? row.lastVerifiedAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

// ── Route plugin ───────────────────────────────────────────────────────────────

export async function packetRoutes(app: FastifyInstance) {
  // GET /api/app/packets — list all packets for the authenticated user
  app.get('/api/app/packets', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const rows = await listPackets(app.db, req.userId!);
    return reply.send({ packets: rows.map(toPacketMetadata) });
  });

  // GET /api/app/packets/:id — get single packet metadata
  app.get('/api/app/packets/:id', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!isValidUuid(id)) return reply.status(400).send({ error: 'Invalid packet id' });

    const row = await getPacketById(app.db, id, req.userId!);
    if (!row) return reply.status(404).send({ error: 'Not found' });

    return reply.send({ packet: toPacketMetadata(row) });
  });

  // POST /api/app/switches/:id/packets/generate — generate a hosted packet for a switch
  app.post(
    '/api/app/switches/:id/packets/generate',
    { preHandler: [app.requireAuth] },
    async (req, reply) => {
      const { id: switchId } = req.params as { id: string };
      if (!isValidUuid(switchId)) return reply.status(400).send({ error: 'Invalid switch id' });

      // Enforce hosted subscription
      const allowed = await canUseHosted(app.db, req.userId!);
      if (!allowed) {
        return reply.status(403).send({ error: 'Hosted subscription required' });
      }

      // Generate a standalone releaseRunId (not tied to an active release run)
      const standaloneReleaseRunId = randomUUID();

      let result: Awaited<ReturnType<typeof buildHostedPacket>>;
      try {
        result = await buildHostedPacket({
          userId: req.userId!,
          switchId,
          releaseRunId: standaloneReleaseRunId,
          db: app.db,
          config: app.config,
        });
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('Switch not found')) {
          return reply.status(404).send({ error: 'Switch not found' });
        }
        throw err;
      }

      // Write audit event
      await writeAuditEvent(app.db, {
        userId: req.userId,
        switchId,
        eventType: 'packet_generated',
        actorType: 'user',
        actorId: req.userId,
        metadata: { packetId: result.packetId, version: result.version },
      });

      // Fetch the full packet row to return metadata
      const row = await getPacketById(app.db, result.packetId, req.userId!);
      if (!row) {
        return reply.status(500).send({ error: 'Packet created but could not be retrieved' });
      }

      return reply.status(201).send({ packet: toPacketMetadata(row) });
    },
  );

  // POST /api/app/packets/:id/verify — verify packet exists in managed storage
  app.post(
    '/api/app/packets/:id/verify',
    { preHandler: [app.requireAuth] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      if (!isValidUuid(id)) return reply.status(400).send({ error: 'Invalid packet id' });

      const row = await getPacketById(app.db, id, req.userId!);
      if (!row) return reply.status(404).send({ error: 'Not found' });

      if (!row.storageObjectKey) {
        return reply.status(422).send({ error: 'Packet has no storage object key' });
      }

      const verification = await verifyManagedPacket({
        storageObjectKey: row.storageObjectKey,
        config: app.config.storage,
      });

      const now = new Date();
      await updatePacketStorage(app.db, row.id, { lastVerifiedAt: now });

      await writeAuditEvent(app.db, {
        userId: req.userId,
        switchId: row.switchId,
        eventType: 'packet_verified',
        actorType: 'user',
        actorId: req.userId,
        metadata: { packetId: row.id, storageExists: verification.exists },
      });

      // Fetch updated row
      const updated = await getPacketById(app.db, row.id, req.userId!);

      return reply.send({
        packet: toPacketMetadata(updated ?? row),
        verified: verification.exists,
      });
    },
  );

  // DELETE /api/app/packets/:id — delete packet from storage and mark as deleted
  app.delete(
    '/api/app/packets/:id',
    { preHandler: [app.requireAuth] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      if (!isValidUuid(id)) return reply.status(400).send({ error: 'Invalid packet id' });

      const row = await getPacketById(app.db, id, req.userId!);
      if (!row) return reply.status(404).send({ error: 'Not found' });

      // Remove from managed storage if present
      if (row.storageObjectKey) {
        await deleteManagedPacket({
          storageObjectKey: row.storageObjectKey,
          config: app.config.storage,
        });
      }

      // Mark as deleted in DB
      await updatePacketStorage(app.db, row.id, { deletionStatus: 'deleted' });

      // Write audit event
      await writeAuditEvent(app.db, {
        userId: req.userId,
        switchId: row.switchId,
        eventType: 'packet_deleted',
        actorType: 'user',
        actorId: req.userId,
        metadata: { packetId: row.id },
      });

      return reply.status(204).send();
    },
  );
}
