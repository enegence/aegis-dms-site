import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { createSession, deleteSession } from '../auth/session.js';
import { sendEmail, buildVerifyEmailHtml, buildResetPasswordHtml } from '../services/email.js';

const registerSchema = z.object({
  displayName: z.string().min(1).max(200),
  email: z.string().email().max(320),
  password: z.string().min(8).max(256),
  timezone: z.string().default('UTC'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const requestResetSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(256),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  // Register
  app.post('/api/auth/register', async (req, reply) => {
    const body = registerSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input', details: body.error.flatten() });
    }

    const { displayName, email, password, timezone } = body.data;

    const [existing] = await app.db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(password);
    const emailVerifyToken = nanoid(32);
    const emailVerifyTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [created] = await app.db.insert(users).values({
      displayName,
      email: email.toLowerCase(),
      passwordHash,
      timezone,
      emailVerifyToken,
      emailVerifyTokenExpiresAt,
    }).returning();

    const sessionId = await createSession(app.db, created.id);

    reply.setCookie('aegis_session', sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 86400,
    });

    sendEmail(
      app.config.postmark.apiToken,
      app.config.postmark.fromEmail,
      created.email,
      'Verify your Aegis account',
      buildVerifyEmailHtml(app.config.baseUrl, emailVerifyToken),
    ).catch(err => app.log.error({ err }, 'Failed to send verification email'));

    return reply.status(201).send({
      user: {
        id: created.id,
        displayName: created.displayName,
        email: created.email,
        emailVerified: created.emailVerified,
        timezone: created.timezone,
        createdAt: created.createdAt.toISOString(),
      },
    });
  });

  // Login
  app.post('/api/auth/login', async (req, reply) => {
    const body = loginSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    const { email, password } = body.data;

    const [user] = await app.db.select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    if (!user) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const sessionId = await createSession(app.db, user.id);

    reply.setCookie('aegis_session', sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 86400,
    });

    return reply.send({
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        emailVerified: user.emailVerified,
        timezone: user.timezone,
      },
    });
  });

  // Get current user
  app.get('/api/auth/me', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const [user] = await app.db.select()
      .from(users)
      .where(eq(users.id, req.userId!));

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      emailVerified: user.emailVerified,
      timezone: user.timezone,
      role: user.role,
      totpEnabled: user.totpEnabled,
      createdAt: user.createdAt.toISOString(),
    });
  });

  // Logout
  app.post('/api/auth/logout', async (req, reply) => {
    const sessionId = req.cookies?.aegis_session;
    if (sessionId) {
      await deleteSession(app.db, sessionId);
      reply.clearCookie('aegis_session', { path: '/' });
    }
    return reply.send({ success: true });
  });

  // Verify email
  app.post('/api/auth/verify-email', async (req, reply) => {
    const body = verifyEmailSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid token' });
    }

    const [user] = await app.db.select()
      .from(users)
      .where(eq(users.emailVerifyToken, body.data.token));

    if (!user) {
      return reply.status(400).send({ error: 'Invalid or expired token' });
    }

    if (user.emailVerifyTokenExpiresAt && user.emailVerifyTokenExpiresAt < new Date()) {
      return reply.status(400).send({ error: 'Token expired' });
    }

    await app.db.update(users)
      .set({
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return reply.send({ success: true });
  });

  // Request password reset
  app.post('/api/auth/request-reset', async (req, reply) => {
    const body = requestResetSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    const [user] = await app.db.select()
      .from(users)
      .where(eq(users.email, body.data.email.toLowerCase()));

    if (user) {
      const resetToken = nanoid(32);
      const tokenHash = createHash('sha256').update(resetToken).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await app.db.update(users)
        .set({
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      sendEmail(
        app.config.postmark.apiToken,
        app.config.postmark.fromEmail,
        user.email,
        'Reset your Aegis password',
        buildResetPasswordHtml(app.config.baseUrl, resetToken),
      ).catch(err => app.log.error({ err }, 'Failed to send reset email'));
    }

    return reply.send({ success: true });
  });

  // Reset password
  app.post('/api/auth/reset-password', async (req, reply) => {
    const body = resetPasswordSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    const tokenHash = createHash('sha256').update(body.data.token).digest('hex');
    const [user] = await app.db.select()
      .from(users)
      .where(eq(users.passwordResetTokenHash, tokenHash));

    if (!user) {
      return reply.status(400).send({ error: 'Invalid or expired token' });
    }

    if (user.passwordResetExpiresAt && user.passwordResetExpiresAt < new Date()) {
      return reply.status(400).send({ error: 'Token expired' });
    }

    const passwordHash = await hashPassword(body.data.password);

    await app.db.update(users)
      .set({
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return reply.send({ success: true });
  });
}
