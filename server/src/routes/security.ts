import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { writeAuditEvent } from '../services/audit.js';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(256),
});

export async function securityRoutes(app: FastifyInstance) {
  // POST /api/security/change-password
  app.post('/api/security/change-password', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const body = changePasswordSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input', details: body.error.flatten() });
    }

    const { currentPassword, newPassword } = body.data;

    // Fetch current user including passwordHash
    const [user] = await app.db
      .select({
        id: users.id,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.id, req.userId!));

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Verify current password
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Current password is incorrect' });
    }

    // Hash new password and update
    const newHash = await hashPassword(newPassword);
    await app.db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, req.userId!));

    await writeAuditEvent(app.db, {
      userId: req.userId!,
      eventType: 'password_changed',
      actorType: 'user',
      actorId: req.userId!,
    });

    return reply.send({ success: true });
  });
}
