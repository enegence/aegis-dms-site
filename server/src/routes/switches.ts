import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import {
  CreateSwitchSchema,
  UpdateSwitchSchema,
  SwitchParamsSchema,
  ArmSwitchSchema,
  CheckInSchema,
} from '../schemas/switches.js';
import { auditEvents } from '../db/schema.js';
import * as repo from '../services/switch-repository.js';
import * as engine from '../services/switch-engine.js';
import { checkSwitchReadiness } from '../services/readiness.js';
import { writeAuditEvent } from '../services/audit.js';

const DELETABLE_STATUSES = ['draft', 'cancelled', 'completed'];

function handleEngineError(err: unknown, reply: import('fastify').FastifyReply) {
  if (err instanceof Error) {
    if (err.message === 'not_found') return reply.status(404).send({ error: 'Not found' });
    if (err.message.startsWith('invalid_state:'))
      return reply.status(409).send({ error: 'Cannot perform action in current state' });
  }
  throw err;
}

export async function switchRoutes(app: FastifyInstance) {
  // GET /api/switches
  app.get('/api/switches', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const switches = await repo.listSwitches(app.db, req.userId!);
    return reply.send({ switches });
  });

  // GET /api/switches/:id
  app.get('/api/switches/:id', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const params = SwitchParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid id' });
    const sw = await repo.getSwitch(app.db, req.userId!, params.data.id);
    if (!sw) return reply.status(404).send({ error: 'Not found' });
    return reply.send({ switch: sw });
  });

  // POST /api/switches
  app.post('/api/switches', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const body = CreateSwitchSchema.safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: 'Invalid input', details: body.error.flatten() });

    const sw = await repo.createSwitch(app.db, req.userId!, body.data);

    await writeAuditEvent(app.db, {
      userId: req.userId,
      switchId: sw.id,
      eventType: 'switch_created',
      actorType: 'user',
      actorId: req.userId,
      metadata: { switchId: sw.id, mode: sw.mode },
    });

    return reply.status(201).send({ switch: sw });
  });

  // PUT /api/switches/:id
  app.put('/api/switches/:id', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const params = SwitchParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid id' });

    const body = UpdateSwitchSchema.safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: 'Invalid input', details: body.error.flatten() });

    // Build patch from only the provided fields; never allow mode change
    const patch: Record<string, unknown> = {};
    const data = body.data;
    if (data.name !== undefined) patch.name = data.name;
    if (data.triggerAt !== undefined) patch.triggerAt = new Date(data.triggerAt);
    if (data.heartbeatIntervalDays !== undefined)
      patch.heartbeatIntervalDays = data.heartbeatIntervalDays;
    if (data.gracePeriodHours !== undefined) patch.gracePeriodHours = data.gracePeriodHours;
    if (data.warningWindowDays !== undefined) patch.warningWindowDays = data.warningWindowDays;
    if (data.selectedContactIds !== undefined)
      patch.selectedContactIds = data.selectedContactIds;
    if (data.selectedEstateItemIds !== undefined)
      patch.selectedEstateItemIds = data.selectedEstateItemIds;

    const sw = await repo.updateSwitch(app.db, req.userId!, params.data.id, patch);
    if (!sw) return reply.status(404).send({ error: 'Not found' });
    return reply.send({ switch: sw });
  });

  // DELETE /api/switches/:id
  app.delete('/api/switches/:id', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const params = SwitchParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid id' });

    const sw = await repo.getSwitch(app.db, req.userId!, params.data.id);
    if (!sw) return reply.status(404).send({ error: 'Not found' });

    if (!DELETABLE_STATUSES.includes(sw.status)) {
      return reply.status(409).send({ error: 'Cannot delete active switch' });
    }

    // Write audit BEFORE nullifying FK references
    await writeAuditEvent(app.db, {
      userId: req.userId,
      switchId: params.data.id,
      eventType: 'switch_deleted',
      actorType: 'user',
      actorId: req.userId,
      metadata: { switchId: params.data.id },
    });

    // Nullify switchId FK on audit events before deletion (no cascade defined on schema)
    await app.db
      .update(auditEvents)
      .set({ switchId: null })
      .where(eq(auditEvents.switchId, params.data.id));

    await repo.deleteSwitch(app.db, req.userId!, params.data.id);

    return reply.send({ ok: true });
  });

  // GET /api/switches/:id/readiness
  app.get('/api/switches/:id/readiness', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const params = SwitchParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid id' });

    const sw = await repo.getSwitch(app.db, req.userId!, params.data.id);
    if (!sw) return reply.status(404).send({ error: 'Not found' });

    const readiness = await checkSwitchReadiness(app.db, req.userId!, sw);
    return reply.send(readiness);
  });

  // POST /api/switches/:id/arm
  app.post('/api/switches/:id/arm', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const params = SwitchParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid id' });

    const body = ArmSwitchSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const sw = await repo.getSwitch(app.db, req.userId!, params.data.id);
    if (!sw) return reply.status(404).send({ error: 'Not found' });

    const readiness = await checkSwitchReadiness(app.db, req.userId!, sw);
    if (!readiness.ready) {
      return reply.status(422).send({ error: 'Switch not ready to arm', checks: readiness.checks });
    }

    try {
      const updated = await engine.armSwitch(app.db, req.userId!, params.data.id);
      return reply.send({ switch: updated });
    } catch (err) {
      return handleEngineError(err, reply);
    }
  });

  // POST /api/switches/:id/pause
  app.post('/api/switches/:id/pause', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const params = SwitchParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid id' });

    try {
      const sw = await engine.pauseSwitch(app.db, req.userId!, params.data.id);
      return reply.send({ switch: sw });
    } catch (err) {
      return handleEngineError(err, reply);
    }
  });

  // POST /api/switches/:id/cancel
  app.post('/api/switches/:id/cancel', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const params = SwitchParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid id' });

    try {
      const sw = await engine.cancelSwitch(app.db, req.userId!, params.data.id);
      return reply.send({ switch: sw });
    } catch (err) {
      return handleEngineError(err, reply);
    }
  });

  // POST /api/switches/:id/check-in
  app.post('/api/switches/:id/check-in', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const params = SwitchParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid id' });

    const body = CheckInSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    try {
      const sw = await engine.checkInSwitch(app.db, req.userId!, params.data.id);
      return reply.send({ switch: sw });
    } catch (err) {
      return handleEngineError(err, reply);
    }
  });

  // POST /api/switches/:id/evaluate
  app.post(
    '/api/switches/:id/evaluate',
    { preHandler: [app.requireAuth] },
    async (req, reply) => {
      const params = SwitchParamsSchema.safeParse(req.params);
      if (!params.success) return reply.status(400).send({ error: 'Invalid id' });

      try {
        const sw = await engine.evaluateSwitch(app.db, req.userId!, params.data.id);
        return reply.send({ switch: sw });
      } catch (err) {
        return handleEngineError(err, reply);
      }
    },
  );
}
