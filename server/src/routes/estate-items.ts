import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const createEstateItemSchema = z.object({
  category: z.string().min(1),
  title: z.string().min(1),
});

export async function estateItemRoutes(app: FastifyInstance) {
  app.post('/api/estate-items', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const body = createEstateItemSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }
    return reply.status(201).send({ id: 'stub', ...body.data });
  });
}
