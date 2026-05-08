import type { FastifyInstance } from 'fastify';
import { CreateEstateItemSchema, UpdateEstateItemSchema, EstateItemParamsSchema } from '../schemas/estate.js';
import * as estateService from '../services/estate.js';
import { writeAuditEvent } from '../services/audit.js';

export async function estateItemRoutes(app: FastifyInstance) {
  // GET /api/estate-items
  app.get('/api/estate-items', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const items = await estateService.listEstateItems(app.db, req.userId!, app.config.fieldEncryptionKey);
    return reply.send({ items });
  });

  // GET /api/estate-items/:id
  app.get('/api/estate-items/:id', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const params = EstateItemParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid id' });
    const item = await estateService.getEstateItem(app.db, req.userId!, params.data.id, app.config.fieldEncryptionKey);
    if (!item) return reply.status(404).send({ error: 'Not found' });
    return reply.send({ item });
  });

  // POST /api/estate-items
  app.post('/api/estate-items', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const body = CreateEstateItemSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', details: body.error.flatten() });
    const item = await estateService.createEstateItem(app.db, req.userId!, body.data, app.config.fieldEncryptionKey);
    await writeAuditEvent(app.db, { userId: req.userId, eventType: 'estate_item_created', actorType: 'user', metadata: { itemId: item.id, category: item.category } });
    return reply.status(201).send({ item });
  });

  // PUT /api/estate-items/:id
  app.put('/api/estate-items/:id', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const params = EstateItemParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid id' });
    const body = UpdateEstateItemSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });
    const item = await estateService.updateEstateItem(app.db, req.userId!, params.data.id, body.data, app.config.fieldEncryptionKey);
    if (!item) return reply.status(404).send({ error: 'Not found' });
    await writeAuditEvent(app.db, { userId: req.userId, eventType: 'estate_item_updated', actorType: 'user', metadata: { itemId: item.id } });
    return reply.send({ item });
  });

  // DELETE /api/estate-items/:id
  app.delete('/api/estate-items/:id', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const params = EstateItemParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid id' });
    const result = await estateService.deleteEstateItem(app.db, req.userId!, params.data.id);
    if (!result.deleted) return reply.status(404).send({ error: 'Not found' });
    await writeAuditEvent(app.db, { userId: req.userId, eventType: 'estate_item_deleted', actorType: 'user', metadata: { itemId: params.data.id } });
    return reply.send({ ok: true });
  });
}
