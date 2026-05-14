import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadConfig, validateProductionConfig, type AppConfig } from './config.js';
import { getDb, type AegisDb } from './db/index.js';
import authPlugin from './auth/plugin.js';
import { validateCsrfToken } from './auth/csrf.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { billingRoutes } from './routes/billing.js';
import { pricingRoutes } from './routes/pricing.js';
import { csrfRoutes } from './routes/csrf.js';
import { estateItemRoutes } from './routes/estate-items.js';
import { contactRoutes } from './routes/contacts.js';
import { relayRoutes } from './routes/relay.js';
import { switchRoutes } from './routes/switches.js';
import { packetRoutes } from './routes/packets.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { claimRoutes } from './routes/claim.js';
import { relayEscrowRoutes } from './routes/relay-escrow.js';
import { adminRoutes } from './routes/admin.js';
import { releaseRunRoutes } from './routes/release-runs.js';
import { onboardingRoutes } from './routes/onboarding.js';
import { relayLinkRoutes } from './routes/relay-link.js';
import { settingsRoutes } from './routes/settings.js';
import { securityRoutes } from './routes/security.js';
import { postmarkWebhookRoutes } from './routes/postmark-webhook.js';
import { accountRoutes } from './routes/account.js';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function buildApp(overrides: Partial<AppConfig> = {}) {
  const config = loadConfig(overrides);
  const isProduction = process.env.NODE_ENV === 'production';

  const app = Fastify({
    logger: !config.testing,
    // Trust Railway's reverse proxy so req.ip / X-Forwarded-For are correct
    trustProxy: isProduction,
  });

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
  await app.register(contactRoutes);
  await app.register(relayRoutes);
  await app.register(switchRoutes);
  await app.register(packetRoutes);
  await app.register(dashboardRoutes);
  await app.register(claimRoutes);
  await app.register(relayEscrowRoutes);
  await app.register(adminRoutes);
  await app.register(releaseRunRoutes);
  await app.register(onboardingRoutes);
  await app.register(relayLinkRoutes);
  await app.register(settingsRoutes);
  await app.register(securityRoutes);
  await app.register(postmarkWebhookRoutes);
  await app.register(accountRoutes);

  // Serve built Vite frontend in production (or when server/static exists)
  // Static dir is at <server-root>/static relative to this compiled file's directory
  const staticDir = join(__dirname, '..', 'static');
  await app.register(fastifyStatic, {
    root: staticDir,
    prefix: '/',
    // Don't throw if the directory doesn't exist (e.g. in dev/test without a build)
    prefixAvoidTrailingSlash: true,
  });

  // SPA fallback: all non-API, non-health routes serve index.html
  app.setNotFoundHandler(async (req, reply) => {
    const url = req.url;
    // API and health routes should return 404, not the SPA
    if (url.startsWith('/api/') || url === '/health') {
      return reply.status(404).send({ error: 'Not found' });
    }
    try {
      // sendFile is added by @fastify/static — serves from the registered root
      return reply.sendFile('index.html');
    } catch {
      return reply.status(404).send({ error: 'Not found' });
    }
  });

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
      '/api/relay/heartbeat',
      '/api/relay/link/exchange',
      '/api/claim/',
      '/webhooks/',
      '/api/account/confirm-deletion', // token-authenticated, no session required
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
  const config = loadConfig();

  // Validate production config before starting — fail fast with clear errors
  if (process.env.NODE_ENV === 'production') {
    validateProductionConfig(config);
  }

  const app = await buildApp();

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
