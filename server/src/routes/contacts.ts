import type { FastifyInstance } from 'fastify';
import {
  CreateContactSchema,
  UpdateContactSchema,
  ContactParamsSchema,
  ReorderContactsSchema,
} from '../schemas/contacts.js';
import * as contactService from '../services/contacts.js';
import { writeAuditEvent } from '../services/audit.js';

export async function contactRoutes(app: FastifyInstance) {
  // GET /api/contacts
  app.get('/api/contacts', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const contacts = await contactService.listContacts(app.db, req.userId!, app.config.fieldEncryptionKey);
    return reply.send({ contacts });
  });

  // GET /api/contacts/:id
  app.get('/api/contacts/:id', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const params = ContactParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid id' });
    const contact = await contactService.getContact(app.db, req.userId!, params.data.id, app.config.fieldEncryptionKey);
    if (!contact) return reply.status(404).send({ error: 'Not found' });
    return reply.send({ contact });
  });

  // POST /api/contacts
  app.post('/api/contacts', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const body = CreateContactSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', details: body.error.flatten() });
    const contact = await contactService.createContact(app.db, req.userId!, body.data, app.config.fieldEncryptionKey);
    await writeAuditEvent(app.db, {
      userId: req.userId,
      eventType: 'contact_created',
      actorType: 'user',
      metadata: { contactId: contact.id },
    });
    return reply.status(201).send({ contact });
  });

  // PUT /api/contacts/:id
  app.put('/api/contacts/:id', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const params = ContactParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid id' });
    const body = UpdateContactSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });
    const contact = await contactService.updateContact(app.db, req.userId!, params.data.id, body.data, app.config.fieldEncryptionKey);
    if (!contact) return reply.status(404).send({ error: 'Not found' });
    await writeAuditEvent(app.db, {
      userId: req.userId,
      eventType: 'contact_updated',
      actorType: 'user',
      metadata: { contactId: contact.id },
    });
    return reply.send({ contact });
  });

  // DELETE /api/contacts/:id
  app.delete('/api/contacts/:id', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const params = ContactParamsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid id' });
    const result = await contactService.deleteContact(app.db, req.userId!, params.data.id);
    if (!result.deleted) return reply.status(404).send({ error: 'Not found' });
    await writeAuditEvent(app.db, {
      userId: req.userId,
      eventType: 'contact_deleted',
      actorType: 'user',
      metadata: { contactId: params.data.id },
    });
    return reply.send({ ok: true });
  });

  // POST /api/contacts/reorder
  app.post('/api/contacts/reorder', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const body = ReorderContactsSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });
    const { orderedIds } = body.data;
    try {
      await contactService.reorderContacts(app.db, req.userId!, orderedIds);
    } catch (err) {
      if (err instanceof Error && err.message === 'invalid_ids') {
        return reply.status(400).send({ error: 'Invalid or foreign contact IDs' });
      }
      throw err;
    }
    await writeAuditEvent(app.db, {
      userId: req.userId,
      eventType: 'contacts_reordered',
      actorType: 'user',
      metadata: { count: orderedIds.length },
    });
    return reply.send({ ok: true });
  });
}
