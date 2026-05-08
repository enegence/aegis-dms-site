import type { FastifyInstance } from 'fastify';
import { generateCsrfToken } from '../auth/csrf.js';

export async function csrfRoutes(app: FastifyInstance) {
  app.get('/api/csrf', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const sessionId = req.cookies?.aegis_session;
    if (!sessionId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }
    const csrfToken = generateCsrfToken(sessionId, app.config.secretKey);
    return reply.send({ csrfToken });
  });
}
