import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import { loadConfig, type AppConfig } from './config.js';
import { healthRoutes } from './routes/health.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
  }
}

export async function buildApp(overrides: Partial<AppConfig> = {}) {
  const config = loadConfig(overrides);
  const app = Fastify({ logger: !config.testing });

  await app.register(cookie, { secret: config.secretKey });
  await app.register(cors, {
    origin: config.testing ? true : config.baseUrl,
    credentials: true,
  });
  await app.register(formbody);

  app.decorate('config', config);

  await app.register(healthRoutes);

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

const isMainModule =
  process.argv[1] &&
  !process.argv[1].includes('vitest') &&
  !process.env.VITEST;
if (isMainModule) {
  start();
}
