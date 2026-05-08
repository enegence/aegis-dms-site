import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import { loadConfig, type AppConfig } from './config.js';
import { getDb, type AegisDb } from './db/index.js';
import authPlugin from './auth/plugin.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    db: AegisDb;
    requireAuth: (req: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>;
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

  app.decorate('config', config);
  app.decorate('db', db);

  await app.register(authPlugin);
  await app.register(healthRoutes);
  await app.register(authRoutes);

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
