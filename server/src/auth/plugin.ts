import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { validateSession } from './session.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    db: import('../db/index.js').AegisDb;  // will be decorated in index.ts
  }
}

async function authPlugin(app: FastifyInstance) {
  app.decorateRequest('userId', undefined);

  app.decorate('requireAuth', async function (req: FastifyRequest, reply: FastifyReply) {
    const sessionId = req.cookies?.aegis_session;
    if (!sessionId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const userId = await validateSession(app.db, sessionId);
    if (!userId) {
      return reply.status(401).send({ error: 'Session expired' });
    }

    req.userId = userId;
  });
}

export default fp(authPlugin, { name: 'aegis-auth' });
