import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import {
  users,
  estateItems,
  contacts,
  switches,
  packets,
  releaseRuns,
  contactClaims,
  notificationDeliveries,
  sessions,
  relayConnections,
  notificationEvents,
  subscriptions,
  auditEvents,
  trustAcknowledgements,
  relayEscrowMaterials,
  encryptionKeys,
  idempotencyKeys,
} from '../db/schema.js';
import { verifyPassword } from '../auth/password.js';
import { buildExportBundle, gatherUserExportPayload } from '../services/export.js';
import { sendEmail } from '../services/email.js';
import { writeAuditEvent } from '../services/audit.js';

const exportSchema = z.object({
  password: z.string().min(1),
  passphrase: z.string().min(1),
});

const requestDeletionSchema = z.object({
  password: z.string().min(1),
});

const confirmDeletionSchema = z.object({
  token: z.string().min(1),
});

export async function accountRoutes(app: FastifyInstance) {
  // POST /api/account/export — create encrypted export bundle with reauth
  app.post('/api/account/export', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const parse = exportSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'Validation failed', issues: parse.error.issues });
    }

    const { password, passphrase } = parse.data;
    const userId = req.userId!;

    // Reauth: verify current password
    const [user] = await app.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    if (user.pendingDeletion || user.deletedAt) {
      return reply.status(403).send({ error: 'Account is pending deletion' });
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return reply.status(401).send({ error: 'Invalid password' });
    }

    // Gather and encrypt export payload
    const payload = await gatherUserExportPayload(
      app.db,
      userId,
      app.config.fieldEncryptionKey,
    );
    const bundle = await buildExportBundle(payload, passphrase);

    await writeAuditEvent(app.db, {
      userId,
      eventType: 'account_export_created',
      actorType: 'user',
      actorId: userId,
    });

    return reply.send(bundle);
  });

  // POST /api/account/request-deletion — reauth, send confirmation email, mark pending
  app.post('/api/account/request-deletion', {
    preHandler: [app.requireAuth],
  }, async (req, reply) => {
    const parse = requestDeletionSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'Validation failed', issues: parse.error.issues });
    }

    const { password } = parse.data;
    const userId = req.userId!;

    const [user] = await app.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Reauth check
    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return reply.status(401).send({ error: 'Invalid password' });
    }

    // Generate deletion token — plaintext only travels in email, store hash
    const deletionToken = nanoid(32);
    const tokenHash = createHash('sha256').update(deletionToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await app.db.update(users)
      .set({
        deletionTokenHash: tokenHash,
        deletionTokenExpiresAt: expiresAt,
        pendingDeletion: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Send confirmation email
    const confirmUrl = `${app.config.baseUrl}/account/confirm-deletion?token=${deletionToken}`;
    const html = buildDeleteAccountHtml(app.config.baseUrl, deletionToken);
    sendEmail(
      app.config.postmark.apiToken,
      app.config.postmark.fromEmail,
      user.email,
      'Confirm Aegis account deletion',
      html,
    ).catch(err => app.log.error({ err }, 'Failed to send deletion confirmation email'));

    await writeAuditEvent(app.db, {
      userId,
      eventType: 'account_deletion_requested',
      actorType: 'user',
      actorId: userId,
    });

    return reply.send({ success: true });
  });

  // POST /api/account/confirm-deletion — validate token, delete data, anonymize user
  app.post('/api/account/confirm-deletion', async (req, reply) => {
    const parse = confirmDeletionSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'Validation failed', issues: parse.error.issues });
    }

    const { token } = parse.data;
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const [user] = await app.db
      .select()
      .from(users)
      .where(eq(users.deletionTokenHash, tokenHash))
      .limit(1);

    if (!user) {
      return reply.status(400).send({ error: 'Invalid or expired deletion token' });
    }

    if (!user.pendingDeletion) {
      return reply.status(400).send({ error: 'No pending deletion request for this account' });
    }

    if (user.deletionTokenExpiresAt && user.deletionTokenExpiresAt < new Date()) {
      return reply.status(400).send({ error: 'Deletion token has expired' });
    }

    const userId = user.id;

    // Cancel active Stripe subscriptions
    try {
      const activeSubs = await app.db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId));

      for (const sub of activeSubs) {
        if (sub.stripeSubscriptionId && sub.status === 'active') {
          try {
            const { getStripe } = await import('../services/stripe.js');
            const stripe = getStripe(app.config.stripe.secretKey);
            await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
          } catch (stripeErr) {
            app.log.error({ err: stripeErr }, 'Failed to cancel Stripe subscription during deletion');
          }
        }
      }
    } catch (err) {
      app.log.error({ err }, 'Error fetching subscriptions for deletion');
    }

    // Delete user data — cascade handles most FK-linked records
    // Explicitly delete records that may not cascade cleanly
    await app.db.delete(notificationDeliveries)
      .where(eq(notificationDeliveries.contactId, userId));

    // Delete all user-owned data (cascade handles most via userId FK)
    // The deletions below handle tables without cascade or for clarity
    await app.db.delete(sessions).where(eq(sessions.userId, userId));
    await app.db.delete(estateItems).where(eq(estateItems.userId, userId));
    await app.db.delete(contacts).where(eq(contacts.userId, userId));
    await app.db.delete(switches).where(eq(switches.userId, userId));
    await app.db.delete(encryptionKeys).where(eq(encryptionKeys.userId, userId));
    await app.db.delete(idempotencyKeys).where(eq(idempotencyKeys.userId, userId));
    await app.db.delete(trustAcknowledgements).where(eq(trustAcknowledgements.userId, userId));

    // Write audit event BEFORE anonymizing userId so we can log it
    await writeAuditEvent(app.db, {
      userId,
      eventType: 'account_deleted',
      actorType: 'user',
      actorId: userId,
      metadata: { deletedAt: new Date().toISOString() },
    });

    // Anonymize user row — do NOT delete so billing/legal records link to a stub
    const anonymizedEmail = `deleted-${userId}@deleted.invalid`;
    await app.db.update(users)
      .set({
        email: anonymizedEmail,
        displayName: 'Deleted User',
        passwordHash: '',
        phone: null,
        totpSecretEncrypted: null,
        totpEnabled: false,
        emailVerifyToken: null,
        emailVerifyTokenExpiresAt: null,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        deletionTokenHash: null,   // invalidate token (single-use)
        deletionTokenExpiresAt: null,
        pendingDeletion: false,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return reply.send({ success: true, deletedAt: new Date().toISOString() });
  });
}

function buildDeleteAccountHtml(baseUrl: string, token: string): string {
  const link = `${baseUrl}/account/confirm-deletion?token=${token}`;
  return `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
      <h1 style="font-size: 24px; color: #0B1C2C;">Confirm account deletion</h1>
      <p style="color: #4A6B8A; line-height: 1.6;">
        We received a request to permanently delete your Aegis account.
        This action is <strong>irreversible</strong>. All your estate items,
        contacts, switches, and release plans will be permanently removed.
      </p>
      <p style="color: #4A6B8A; line-height: 1.6;">
        We strongly recommend downloading an export of your data before confirming deletion.
      </p>
      <a href="${link}" style="display: inline-block; background: #C0392B; color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">
        Confirm Account Deletion
      </a>
      <p style="color: #8AAAC8; font-size: 12px;">
        This link expires in 15 minutes. If you did not request deletion, ignore this email — your account is safe.
      </p>
    </div>
  `;
}
