import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import { loadConfig, type AppConfig } from './config.js';
import { getDb, type AegisDb } from './db/index.js';
import authPlugin from './auth/plugin.js';
import { validateCsrfToken } from './auth/csrf.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { billingRoutes } from './routes/billing.js';
import { pricingRoutes } from './routes/pricing.js';
import { csrfRoutes } from './routes/csrf.js';
import { estateItemRoutes } from './routes/estate-items.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    db: AegisDb;
    requireAuth: (req: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    userId?: string;
    rawBody?: string;
  }
}

export async function buildApp(overrides: Partial<AppConfig> = {}) {
  const config = loadConfig(overrides);
  const app = Fastify({ logger: !config.testing });

  const db = getDb(config.databaseUrl);

  await app.register(cookie, { secret: config.secretKey });
  await app.register(cors, {
    origin: config.testing ? true : config.baseUrl,
    credentials: true,
  });
  await app.register(formbody);

  app.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
    try {
      const json = JSON.parse(body as string);
      (req as any).rawBody = body;
      done(null, json);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.decorate('config', config);
  app.decorate('db', db);

  await app.register(authPlugin);
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(billingRoutes);
  await app.register(pricingRoutes);
  await app.register(csrfRoutes);
  await app.register(estateItemRoutes);

  app.addHook('onRequest', async (req, reply) => {
    const method = req.method;
    const url = req.url;

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;
    if (!url.startsWith('/api/')) return;

    const exemptPaths = [
      '/api/auth/register', '/api/auth/login', '/api/auth/logout',
      '/api/auth/forgot-password', '/api/auth/reset-password',
      '/api/auth/request-reset', '/api/auth/verify-email',
      '/api/billing/webhook',
    ];
    if (exemptPaths.some(p => url.startsWith(p))) return;

    const sessionId = req.cookies?.aegis_session;
    if (!sessionId) return;

    const csrfToken = req.headers['x-csrf-token'] as string | undefined;
    if (!csrfToken || !validateCsrfToken(csrfToken, sessionId, app.config.secretKey)) {
      return reply.status(403).send({ error: 'CSRF token missing or invalid' });
    }
  });

  return app;
}

async function start() {
  const app = await buildApp();
  const config = loadConfig();

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`Aegis SaaS server listening on ${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const isMainModule = process.argv[1] && !process.argv[1].includes('vitest') && !process.env.VITEST;
if (isMainModule) {
  start();
}
