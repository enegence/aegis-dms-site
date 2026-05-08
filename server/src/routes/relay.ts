import type { FastifyInstance } from 'fastify';
import { CreateRelayConnectionSchema, UpdateRelayConnectionSchema, RelayConnectionParamsSchema } from '../schemas/relay.js';
import * as relayService from '../services/relay-connections.js';
import { writeAuditEvent } from '../services/audit.js';

export async function relayRoutes(app: FastifyInstance) {
  // GET /api/relay/connections
  app.get('/api/relay/connections', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const connections = await relayService.listRelayConnections(app.db, req.userId!);
    return reply.send({ connections: connections.map(formatConnection) });
  });

  // GET /api/relay/connections/:id
  app.get('/api/relay/connections/:id', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const params = RelayConnectionParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid id' });
    const conn = await relayService.getRelayConnection(app.db, req.userId!, params.data.id);
    if (!conn) return reply.status(404).send({ error: 'Not found' });
    return reply.send({ connection: formatConnection(conn) });
  });

  // POST /api/relay/connections
  app.post('/api/relay/connections', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const body = CreateRelayConnectionSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', details: body.error.flatten() });
    const { connection, rawApiKey } = await relayService.createRelayConnection(app.db, req.userId!, body.data);
    await writeAuditEvent(app.db, { userId: req.userId, eventType: 'relay_connection_created', actorType: 'user', metadata: { connectionId: connection.id, label: connection.label } });
    // Return raw API key only once
    return reply.status(201).send({ connection: formatConnection(connection), apiKey: rawApiKey });
  });

  // PATCH /api/relay/connections/:id
  app.patch('/api/relay/connections/:id', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const params = RelayConnectionParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid id' });
    const body = UpdateRelayConnectionSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });
    const conn = await relayService.updateRelayConnection(app.db, req.userId!, params.data.id, body.data);
    if (!conn) return reply.status(404).send({ error: 'Not found' });
    await writeAuditEvent(app.db, { userId: req.userId, eventType: 'relay_connection_updated', actorType: 'user', metadata: { connectionId: conn.id } });
    return reply.send({ connection: formatConnection(conn) });
  });

  // POST /api/relay/connections/:id/rotate-key
  app.post('/api/relay/connections/:id/rotate-key', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const params = RelayConnectionParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid id' });
    const result = await relayService.rotateRelayKey(app.db, req.userId!, params.data.id);
    if (!result) return reply.status(404).send({ error: 'Not found' });
    await writeAuditEvent(app.db, { userId: req.userId, eventType: 'relay_key_rotated', actorType: 'user', metadata: { connectionId: params.data.id } });
    // Return new raw API key only once
    return reply.send({ connection: formatConnection(result.connection), apiKey: result.rawApiKey });
  });

  // POST /api/relay/connections/:id/revoke
  app.post('/api/relay/connections/:id/revoke', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const params = RelayConnectionParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid id' });
    const ok = await relayService.revokeRelayConnection(app.db, req.userId!, params.data.id);
    if (!ok) return reply.status(404).send({ error: 'Not found' });
    await writeAuditEvent(app.db, { userId: req.userId, eventType: 'relay_connection_revoked', actorType: 'user', metadata: { connectionId: params.data.id } });
    return reply.send({ ok: true });
  });

  // DELETE /api/relay/connections/:id
  app.delete('/api/relay/connections/:id', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const params = RelayConnectionParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid id' });
    const ok = await relayService.deleteRelayConnection(app.db, req.userId!, params.data.id);
    if (!ok) return reply.status(404).send({ error: 'Not found' });
    await writeAuditEvent(app.db, { userId: req.userId, eventType: 'relay_connection_deleted', actorType: 'user', metadata: { connectionId: params.data.id } });
    return reply.send({ ok: true });
  });
}

function formatConnection(conn: {
  id: string;
  label: string | null;
  status: string;
  lastHeartbeatAt: Date | null;
  lastExpectedHeartbeatAt: Date | null;
  mode: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: conn.id,
    label: conn.label,
    status: conn.status,
    lastHeartbeatAt: conn.lastHeartbeatAt?.toISOString() ?? null,
    lastExpectedHeartbeatAt: conn.lastExpectedHeartbeatAt?.toISOString() ?? null,
    mode: conn.mode,
    createdAt: conn.createdAt.toISOString(),
  };
}
