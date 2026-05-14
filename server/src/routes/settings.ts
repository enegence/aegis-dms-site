import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema.js';
import { writeAuditEvent } from '../services/audit.js';

const updateAccountSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  // Email change is not supported in alpha — rejected if provided
  email: z.undefined({
    errorMap: () => ({ message: 'Email changes are not supported in alpha' }),
  }).optional(),
}).strict();

export async function settingsRoutes(app: FastifyInstance) {
  // GET /api/settings/account
  app.get('/api/settings/account', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const [user] = await app.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        emailVerified: users.emailVerified,
        timezone: users.timezone,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, req.userId!));

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      timezone: user.timezone,
      createdAt: user.createdAt.toISOString(),
    });
  });

  // PUT /api/settings/account
  app.put('/api/settings/account', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const body = updateAccountSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input', details: body.error.flatten() });
    }

    const { displayName } = body.data;

    if (!displayName) {
      return reply.status(400).send({ error: 'No updatable fields provided' });
    }

    await app.db
      .update(users)
      .set({ displayName, updatedAt: new Date() })
      .where(eq(users.id, req.userId!));

    await writeAuditEvent(app.db, {
      userId: req.userId!,
      eventType: 'profile_updated',
      actorType: 'user',
      actorId: req.userId!,
      metadata: { fields: ['displayName'] },
    });

    const [updated] = await app.db
      .select({
        email: users.email,
        displayName: users.displayName,
        emailVerified: users.emailVerified,
        timezone: users.timezone,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, req.userId!));

    return reply.send({
      email: updated.email,
      displayName: updated.displayName,
      emailVerified: updated.emailVerified,
      timezone: updated.timezone,
      createdAt: updated.createdAt.toISOString(),
    });
  });
}
