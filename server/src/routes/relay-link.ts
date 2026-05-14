/**
 * relay-link.ts — Routes for secure OSS-to-Relay instance linking.
 *
 * POST /api/relay/link/start    — authenticated user generates a one-time link code
 * POST /api/relay/link/exchange — server-to-server, OSS instance exchanges code for API key
 *
 * Security notes:
 *   - link/start requires auth + CSRF (browser-facing).
 *   - link/exchange is CSRF-exempt — it is called by an OSS instance, not a browser.
 *   - link/exchange does NOT require a user session.
 *   - Plaintext code never stored on server; only SHA-256 hash persisted.
 *   - API key returned once in response body — never in URL.
 */

import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { writeAuditEvent } from '../services/audit.js';
import { canUseRelay } from '../services/subscription-gate.js';
import {
  startLinkCode,
  exchangeLinkCode,
  isValidCallbackUrl,
} from '../services/relay-link.js';

const StartLinkBodySchema = z.object({
  callbackUrl: z.string().url().max(2048),
  state: z.string().min(8).max(256),
  label: z.string().max(200).optional(),
});

const ExchangeLinkBodySchema = z.object({
  code: z.string().min(1).max(256),
  state: z.string().min(1).max(256),
  instanceId: z.string().max(256).optional(),
  instanceLabel: z.string().max(200).optional(),
});

export async function relayLinkRoutes(app: FastifyInstance) {
  // POST /api/relay/link/start
  // Generates a one-time link code. Auth + CSRF required.
  app.post('/api/relay/link/start', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const body = StartLinkBodySchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input', details: body.error.flatten() });
    }

    if (!isValidCallbackUrl(body.data.callbackUrl)) {
      return reply.status(400).send({
        error: 'invalid_callback_url',
        message: 'callbackUrl must be a self-hosted address (localhost, private IP, or https://).',
      });
    }

    const allowed = await canUseRelay(app.db, req.userId!);
    if (!allowed) {
      return reply.status(403).send({
        error: 'subscription_required',
        message: 'An active Relay subscription is required to link a self-hosted instance.',
      });
    }

    const { linkCodeId, code } = await startLinkCode(
      app.db,
      req.userId!,
      body.data.callbackUrl,
      body.data.state,
      body.data.label,
    );

    await writeAuditEvent(app.db, {
      userId: req.userId,
      eventType: 'relay_link_code_created',
      actorType: 'user',
      metadata: { linkCodeId },
    });

    // Return the one-time code — user copies this into Aegis Core config.
    // The OSS instance will POST code + state to /api/relay/link/exchange.
    return reply.status(201).send({
      code,
      linkCodeId,
      exchangeUrl: `${app.config.baseUrl}/api/relay/link/exchange`,
      instructions: [
        'Copy the code below and paste it into your Aegis Core configuration.',
        'Your Aegis Core instance will POST this code to the exchangeUrl to complete linking.',
        'This code expires in 10 minutes and can only be used once.',
      ],
    });
  });

  // POST /api/relay/link/exchange
  // Called server-to-server by an OSS instance. No session, no CSRF.
  // The exchange endpoint is added to the CSRF exemption list in index.ts.
  app.post('/api/relay/link/exchange', async (req, reply) => {
    const body = ExchangeLinkBodySchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input', details: body.error.flatten() });
    }

    const result = await exchangeLinkCode(
      app.db,
      body.data.code,
      body.data.state,
      app.config.baseUrl,
      body.data.instanceLabel ?? body.data.instanceId,
    );

    if ('error' in result) {
      switch (result.error) {
        case 'not_found':
          return reply.status(404).send({ error: 'Link code not found or already expired.' });
        case 'expired':
          return reply.status(410).send({ error: 'Link code has expired.' });
        case 'used':
          return reply.status(410).send({ error: 'Link code has already been used.' });
        case 'state_mismatch':
          return reply.status(400).send({ error: 'State mismatch. Linking aborted.' });
      }
    }

    await writeAuditEvent(app.db, {
      userId: undefined, // server-to-server — no user session
      eventType: 'relay_link_code_exchanged',
      actorType: 'relay',
      metadata: {
        connectionId: result.connectionId,
        instanceId: body.data.instanceId ?? null,
      },
    });

    // API key returned once in response body — never in URL, never stored plaintext.
    return reply.status(201).send({
      relayEndpoint: result.relayEndpoint,
      apiKey: result.apiKey,
      connectionId: result.connectionId,
    });
  });
}
