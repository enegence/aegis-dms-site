/**
 * Postmark inbound webhook route.
 *
 * POST /webhooks/postmark
 *
 * Auth: validated via X-Postmark-Token header matched against
 * POSTMARK_WEBHOOK_TOKEN env var (configured in Postmark dashboard).
 *
 * Handles: Delivery, Bounce, SpamComplaint, Open events.
 * Idempotent: duplicate events produce no extra DB writes.
 *
 * Security:
 *  - 401 on missing or invalid token — webhook calls are from Postmark infra,
 *    not from browser sessions, so CSRF exemption applies.
 *  - No PII is echoed back in responses.
 */

import { timingSafeEqual } from 'crypto';
import type { FastifyInstance } from 'fastify';
import { ingestPostmarkEvent, type PostmarkEvent } from '../services/postmark-events.js';

export async function postmarkWebhookRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /webhooks/postmark
   *
   * Validates the X-Postmark-Token header, then processes the event.
   * Returns 200 on success (Postmark requires 2xx to not retry).
   * Returns 401 on auth failure.
   */
  app.post('/webhooks/postmark', async (req, reply) => {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const webhookToken = process.env.POSTMARK_WEBHOOK_TOKEN ?? '';
    if (!webhookToken) {
      // Token not configured — reject all events to avoid silent misconfiguration
      return reply.status(401).send({ error: 'Webhook token not configured' });
    }

    const incomingToken =
      (req.headers['x-postmark-token'] as string | undefined) ??
      (req.headers['x-webhook-token'] as string | undefined) ??
      '';

    if (!incomingToken) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const match = timingSafeEqual(
        Buffer.from(incomingToken),
        Buffer.from(webhookToken),
      );
      if (!match) return reply.status(401).send({ error: 'Unauthorized' });
    } catch {
      // timingSafeEqual throws if buffers differ in length
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // ── Parse event ───────────────────────────────────────────────────────────
    const body = req.body as PostmarkEvent;

    if (!body || typeof body !== 'object' || !body.RecordType) {
      return reply.status(400).send({ error: 'Invalid event payload' });
    }

    // ── Ingest ────────────────────────────────────────────────────────────────
    try {
      const result = await ingestPostmarkEvent(app.db, body);
      return reply.status(200).send({ ok: true, action: result.action });
    } catch (err) {
      // Log without PII, return 500 so Postmark will retry
      app.log.error({ msg: 'postmark-webhook: ingest error', recordType: body.RecordType });
      return reply.status(500).send({ error: 'internal_error' });
    }
  });
}
