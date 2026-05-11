/**
 * claim.ts — Public hosted claim portal routes.
 *
 * Routes (no auth required — contacts access via token only):
 *   GET  /api/claim/:token              — get claim status
 *   POST /api/claim/:token/open         — mark claim opened
 *   POST /api/claim/:token/verify       — verify identity (PIN if configured)
 *   POST /api/claim/:token/accept       — accept responsibility
 *   GET  /api/claim/:token/packet       — download packet (after accepted)
 *   POST /api/claim/:token/key-view     — record key/release material viewed
 *   POST /api/claim/:token/acknowledge  — final acknowledgement
 *
 * Security notes:
 *   - Token is hashed server-side (SHA-256). Raw token never stored.
 *   - All error responses for invalid/expired tokens are generic (no leakage).
 *   - Packet download only allowed in accepted/packet_downloaded/key_viewed states.
 *   - No contact PII returned in claim status responses.
 *   - CSRF exempt — these are public unauthenticated routes.
 */

import { createHash } from 'crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import {
  getContactClaimByTokenHash,
  updateContactClaim,
} from '../repositories/contact-claim-repository.js';
import { acknowledgeClaim } from '../services/hosted-cascade.js';
import { downloadManagedPacket } from '../services/storage/index.js';
import { writeAuditEvent } from '../services/audit.js';
import { decryptField } from '../services/field-encrypt.js';
import { contacts, packets } from '../db/schema.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

const CLAIMABLE_STATES = new Set([
  'pending', 'notified', 'opened', 'verified', 'accepted',
  'packet_downloaded', 'key_viewed',
]);

const TERMINAL_STATES = new Set(['acknowledged', 'expired', 'escalated', 'failed']);

function isExpired(claim: { expiresAt: Date | null; status: string }): boolean {
  if (TERMINAL_STATES.has(claim.status)) return true;
  if (claim.expiresAt && new Date() > claim.expiresAt) return true;
  return false;
}

function claimPublicView(claim: {
  id: string;
  status: string;
  expiresAt: Date | null;
  notifiedAt: Date | null;
  openedAt: Date | null;
  verifiedAt: Date | null;
  acceptedAt: Date | null;
  packetDownloadedAt: Date | null;
  keyViewedAt: Date | null;
  acknowledgedAt: Date | null;
}) {
  return {
    id: claim.id,
    status: claim.status,
    expiresAt: claim.expiresAt?.toISOString() ?? null,
    notifiedAt: claim.notifiedAt?.toISOString() ?? null,
    openedAt: claim.openedAt?.toISOString() ?? null,
    verifiedAt: claim.verifiedAt?.toISOString() ?? null,
    acceptedAt: claim.acceptedAt?.toISOString() ?? null,
    packetDownloadedAt: claim.packetDownloadedAt?.toISOString() ?? null,
    keyViewedAt: claim.keyViewedAt?.toISOString() ?? null,
    acknowledgedAt: claim.acknowledgedAt?.toISOString() ?? null,
  };
}

// Generic not-found / expired response — no information leakage
function genericNotFound(reply: FastifyReply) {
  return reply.status(404).send({ error: 'claim_not_found' });
}

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 20;
const claimRateLimit = new Map<string, { count: number; resetAt: number }>();

function rateLimitKey(req: { ip?: string }, tokenHash: string, action: string): string {
  return `${req.ip ?? 'unknown'}:${action}:${tokenHash}`;
}

function isRateLimited(req: { ip?: string }, tokenHash: string, action: string): boolean {
  const now = Date.now();
  const key = rateLimitKey(req, tokenHash, action);
  const current = claimRateLimit.get(key);

  if (!current || current.resetAt <= now) {
    claimRateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT_MAX_ATTEMPTS;
}

function rateLimited(reply: FastifyReply) {
  return reply.status(429).send({ error: 'too_many_attempts' });
}

// ── Route plugin ──────────────────────────────────────────────────────────────

export async function claimRoutes(app: FastifyInstance) {
  async function getClaimStatus(token: string, reply: FastifyReply) {
    const tokenHash = hashToken(token);
    const claim = await getContactClaimByTokenHash(app.db, tokenHash);
    if (!claim || isExpired(claim)) return genericNotFound(reply);

    return reply.send(claimPublicView(claim));
  }

  app.get<{ Params: { token: string } }>('/claim/:token', async (req, reply) => {
    return getClaimStatus(req.params.token, reply);
  });

  // ── GET /api/claim/:token ─────────────────────────────────────────────────
  app.get<{ Params: { token: string } }>('/api/claim/:token', async (req, reply) => {
    return getClaimStatus(req.params.token, reply);
  });

  // ── POST /api/claim/:token/open ───────────────────────────────────────────
  app.post<{ Params: { token: string } }>('/api/claim/:token/open', async (req, reply) => {
    const { token } = req.params;
    const tokenHash = hashToken(token);
    if (isRateLimited(req, tokenHash, 'open')) return rateLimited(reply);

    const claim = await getContactClaimByTokenHash(app.db, tokenHash);
    if (!claim || isExpired(claim)) return genericNotFound(reply);
    if (!CLAIMABLE_STATES.has(claim.status)) return genericNotFound(reply);

    const now = new Date();
    const updated = await updateContactClaim(app.db, claim.id, {
      status: 'opened',
      openedAt: claim.openedAt ?? now,
    });

    await writeAuditEvent(app.db, {
      releaseRunId: claim.releaseRunId ?? null,
      eventType: 'contact_opened_claim',
      actorType: 'contact',
      metadata: { claimId: claim.id },
    });

    return reply.send(claimPublicView(updated!));
  });

  // ── POST /api/claim/:token/verify ─────────────────────────────────────────
  app.post<{ Params: { token: string }; Body: { pin?: string } }>(
    '/api/claim/:token/verify',
    async (req, reply) => {
      const { token } = req.params;
      const tokenHash = hashToken(token);
      if (isRateLimited(req, tokenHash, 'verify')) return rateLimited(reply);

      const claim = await getContactClaimByTokenHash(app.db, tokenHash);
      if (!claim || isExpired(claim)) return genericNotFound(reply);
      if (!CLAIMABLE_STATES.has(claim.status)) return genericNotFound(reply);

      const contactRows = await app.db
        .select({ claimPinHash: contacts.claimPinHash })
        .from(contacts)
        .where(eq(contacts.id, claim.contactId));

      const contact = contactRows[0];
      if (contact?.claimPinHash) {
        const pin = req.body?.pin ?? '';
        const pinHash = createHash('sha256').update(pin).digest('hex');
        if (pinHash !== contact.claimPinHash) {
          return reply.status(403).send({ error: 'invalid_pin' });
        }
      }

      const now = new Date();
      const updated = await updateContactClaim(app.db, claim.id, {
        status: 'verified',
        verifiedAt: claim.verifiedAt ?? now,
      });

      await writeAuditEvent(app.db, {
        releaseRunId: claim.releaseRunId ?? null,
        eventType: 'contact_verified',
        actorType: 'contact',
        metadata: { claimId: claim.id },
      });

      return reply.send(claimPublicView(updated!));
    },
  );

  // ── POST /api/claim/:token/accept ─────────────────────────────────────────
  app.post<{ Params: { token: string } }>('/api/claim/:token/accept', async (req, reply) => {
    const { token } = req.params;
    const tokenHash = hashToken(token);
    if (isRateLimited(req, tokenHash, 'accept')) return rateLimited(reply);

    const claim = await getContactClaimByTokenHash(app.db, tokenHash);
    if (!claim || isExpired(claim)) return genericNotFound(reply);
    if (claim.status !== 'verified') {
      return reply.status(400).send({ error: 'invalid_state' });
    }

    const now = new Date();
    const updated = await updateContactClaim(app.db, claim.id, {
      status: 'accepted',
      acceptedAt: now,
    });

    await writeAuditEvent(app.db, {
      releaseRunId: claim.releaseRunId ?? null,
      eventType: 'contact_accepted',
      actorType: 'contact',
      metadata: { claimId: claim.id },
    });

    return reply.send(claimPublicView(updated!));
  });

  // ── GET /api/claim/:token/packet ──────────────────────────────────────────
  app.get<{ Params: { token: string } }>('/api/claim/:token/packet', async (req, reply) => {
    const { token } = req.params;
    const tokenHash = hashToken(token);
    if (isRateLimited(req, tokenHash, 'packet')) return rateLimited(reply);

    const claim = await getContactClaimByTokenHash(app.db, tokenHash);
    if (!claim || isExpired(claim)) return genericNotFound(reply);

    const allowedForDownload = new Set(['accepted', 'packet_downloaded', 'key_viewed']);
    if (!allowedForDownload.has(claim.status)) {
      return reply.status(403).send({ error: 'not_yet_accepted' });
    }

    const packetRows = await app.db
      .select()
      .from(packets)
      .where(eq(packets.id, claim.packetId));

    const packet = packetRows[0];
    if (!packet?.storageObjectKey) {
      return reply.status(503).send({ error: 'packet_unavailable' });
    }

    const now = new Date();
    await updateContactClaim(app.db, claim.id, {
      status: 'packet_downloaded',
      packetDownloadedAt: claim.packetDownloadedAt ?? now,
    });

    await writeAuditEvent(app.db, {
      releaseRunId: claim.releaseRunId ?? null,
      eventType: 'packet_downloaded',
      actorType: 'contact',
      metadata: { claimId: claim.id },
    });

    // Stream encrypted packet bytes
    const encryptedData = await downloadManagedPacket({
      storageObjectKey: packet.storageObjectKey,
      config: app.config.storage,
    });

    return reply
      .header('Content-Type', 'application/octet-stream')
      .header(
        'Content-Disposition',
        `attachment; filename="aegis-packet-${claim.packetId}.aegis.enc"`,
      )
      .send(encryptedData);
  });

  // ── POST /api/claim/:token/key-view ───────────────────────────────────────
  app.post<{ Params: { token: string } }>('/api/claim/:token/key-view', async (req, reply) => {
    const { token } = req.params;
    const tokenHash = hashToken(token);
    if (isRateLimited(req, tokenHash, 'key-view')) return rateLimited(reply);

    const claim = await getContactClaimByTokenHash(app.db, tokenHash);
    if (!claim || isExpired(claim)) return genericNotFound(reply);

    if (claim.status !== 'packet_downloaded') {
      return reply.status(400).send({ error: 'invalid_state' });
    }

    const packetRows = await app.db
      .select({
        id: packets.id,
        keyId: packets.keyId,
        encryptionAlgorithm: packets.encryptionAlgorithm,
        packetKeyEncrypted: packets.packetKeyEncrypted,
      })
      .from(packets)
      .where(eq(packets.id, claim.packetId));

    const packet = packetRows[0];
    if (!packet?.packetKeyEncrypted) {
      return reply.status(503).send({ error: 'release_material_unavailable' });
    }

    const packetKey = decryptField(packet.packetKeyEncrypted, app.config.fieldEncryptionKey);

    const now = new Date();
    const updated = await updateContactClaim(app.db, claim.id, {
      status: 'key_viewed',
      keyViewedAt: claim.keyViewedAt ?? now,
    });

    // SECURITY: log audit event without logging the actual key/material
    await writeAuditEvent(app.db, {
      releaseRunId: claim.releaseRunId ?? null,
      eventType: 'release_material_viewed',
      actorType: 'contact',
      metadata: { claimId: claim.id },
    });

    return reply.send({
      ...claimPublicView(updated!),
      releaseMaterial: {
        keyId: packet.keyId,
        encryptionAlgorithm: packet.encryptionAlgorithm,
        packetKey,
        encoding: 'base64',
      },
    });
  });

  // ── POST /api/claim/:token/acknowledge ────────────────────────────────────
  app.post<{ Params: { token: string } }>(
    '/api/claim/:token/acknowledge',
    async (req, reply) => {
      const { token } = req.params;
      const tokenHash = hashToken(token);
      if (isRateLimited(req, tokenHash, 'acknowledge')) return rateLimited(reply);

      const claim = await getContactClaimByTokenHash(app.db, tokenHash);
      if (!claim || isExpired(claim)) return genericNotFound(reply);

      try {
        await acknowledgeClaim(app.db, claim.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.status(400).send({ error: msg });
      }

      // Re-fetch to return final state
      const final = await getContactClaimByTokenHash(app.db, tokenHash);
      return reply.send(claimPublicView(final!));
    },
  );
}
