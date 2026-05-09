/**
 * Hosted notification dispatch service.
 *
 * All functions accept decrypted PII (email, telegram handle) for transport
 * ONLY — these values are NEVER stored in audit logs or notification events.
 * The recipientRef stored in notification_events is always the contactId (UUID)
 * or another non-PII reference.
 *
 * Security invariants:
 *  - Never log toEmail, toTelegramHandle, or message content.
 *  - recipientRef stored in DB is always a UUID or redacted tag — never an address.
 *  - Errors are caught and stored with redacted messages.
 */

import type { AegisDb } from '../db/index.js';
import type { AppConfig } from '../config.js';
import { sendEmailStructured } from './email.js';
import { sendTelegramMessage, telegramChatIdFromHandle } from './telegram.js';
import { createNotificationEvent } from '../repositories/notification-event-repository.js';

export interface NotificationContext {
  db: AegisDb;
  config: AppConfig;
}

// ── Owner alert ───────────────────────────────────────────────────────────────

/**
 * Send an alert to the account owner (e.g. relay offline, release started).
 * Owner is identified by userId; the toEmail is decrypted at the call site.
 */
export async function sendOwnerAlert(
  ctx: NotificationContext,
  input: {
    userId: string;
    toEmail: string;
    subject: string;
    htmlBody: string;
    textBody: string;
    purpose: string;
  },
): Promise<void> {
  const { db, config } = ctx;

  const result = await sendEmailStructured(config.postmark.apiToken, {
    from: config.postmark.fromEmail,
    to: input.toEmail,
    subject: input.subject,
    htmlBody: input.htmlBody,
    textBody: input.textBody,
  });

  await createNotificationEvent(db, {
    userId: input.userId,
    channel: 'email',
    provider: 'postmark',
    recipientRef: `user:${input.userId}`,
    status: result.messageId ? 'sent' : 'failed',
    providerMessageId: result.messageId ?? null,
    errorCode: result.error ?? null,
    errorMessageRedacted: result.error ?? null,
  });
}

// ── Contact claim notification ────────────────────────────────────────────────

/**
 * Notify a contact that a claim link is available (email + optional Telegram).
 * The toEmail and toTelegramHandle are decrypted at the call site and used
 * for transport only. recipientRef stored in DB is the contactId.
 */
export async function sendContactClaimNotification(
  ctx: NotificationContext,
  input: {
    userId: string;
    contactId: string;
    releaseRunId?: string | null;
    contactClaimId?: string | null;
    toEmail: string;
    toTelegramHandle?: string | null;
    subject: string;
    htmlBody: string;
    textBody: string;
    claimUrl: string;
  },
): Promise<void> {
  const { db, config } = ctx;

  // ── Email ─────────────────────────────────────────────────────────────────
  const emailResult = await sendEmailStructured(config.postmark.apiToken, {
    from: config.postmark.fromEmail,
    to: input.toEmail,
    subject: input.subject,
    htmlBody: input.htmlBody,
    textBody: input.textBody,
  });

  await createNotificationEvent(db, {
    userId: input.userId,
    releaseRunId: input.releaseRunId ?? null,
    contactClaimId: input.contactClaimId ?? null,
    channel: 'email',
    provider: 'postmark',
    recipientRef: input.contactId,
    status: emailResult.messageId ? 'sent' : 'failed',
    providerMessageId: emailResult.messageId ?? null,
    errorCode: emailResult.error ?? null,
    errorMessageRedacted: emailResult.error ?? null,
  });

  // ── Telegram (optional) ───────────────────────────────────────────────────
  if (input.toTelegramHandle) {
    const chatId = telegramChatIdFromHandle(input.toTelegramHandle);
    const tgMessage = `${input.subject}\n\n${input.textBody}\n\nClaim link: ${input.claimUrl}`;

    const tgResult = await sendTelegramMessage(
      config.telegram.botToken,
      chatId,
      tgMessage,
    );

    await createNotificationEvent(db, {
      userId: input.userId,
      releaseRunId: input.releaseRunId ?? null,
      contactClaimId: input.contactClaimId ?? null,
      channel: 'telegram',
      provider: 'telegram',
      recipientRef: input.contactId,
      status: tgResult.ok ? 'sent' : 'failed',
      providerMessageId: tgResult.messageId ? String(tgResult.messageId) : null,
      errorCode: tgResult.error ?? null,
      errorMessageRedacted: tgResult.error ?? null,
    });
  }
}

// ── Relay offline alert ───────────────────────────────────────────────────────

/**
 * Alert an owner that a relay connection has gone offline.
 * toEmail is decrypted at the call site.
 */
export async function sendRelayOfflineAlert(
  ctx: NotificationContext,
  input: {
    userId: string;
    toEmail: string;
    relayConnectionId: string;
    offlineSince: Date;
  },
): Promise<void> {
  const { db, config } = ctx;

  const offlineAt = input.offlineSince.toISOString();
  const subject = 'Aegis Relay connection offline';
  const textBody = `Your Aegis Relay connection has been offline since ${offlineAt}. Please check your relay setup.`;
  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #0B1C2C;">Relay connection offline</h2>
      <p style="color: #4A6B8A;">Your Aegis Relay connection has been offline since <strong>${offlineAt}</strong>.</p>
      <p style="color: #4A6B8A;">Please check your relay configuration to avoid a missed heartbeat.</p>
    </div>
  `;

  const result = await sendEmailStructured(config.postmark.apiToken, {
    from: config.postmark.fromEmail,
    to: input.toEmail,
    subject,
    htmlBody,
    textBody,
  });

  await createNotificationEvent(db, {
    userId: input.userId,
    channel: 'email',
    provider: 'postmark',
    recipientRef: `user:${input.userId}`,
    status: result.messageId ? 'sent' : 'failed',
    providerMessageId: result.messageId ?? null,
    errorCode: result.error ?? null,
    errorMessageRedacted: result.error ?? null,
  });
}

// ── Cascade escalation notice ─────────────────────────────────────────────────

/**
 * Notify the next contact in the cascade that a release is now active for them.
 * toEmail and toTelegramHandle are decrypted at the call site.
 */
export async function sendCascadeEscalationNotice(
  ctx: NotificationContext,
  input: {
    userId: string;
    contactId: string;
    releaseRunId: string;
    contactClaimId: string;
    toEmail: string;
    toTelegramHandle?: string | null;
    claimUrl: string;
  },
): Promise<void> {
  const subject = 'Important: You have a pending Aegis claim';
  const textBody = `Someone has designated you as a recipient in their Aegis DMS release. Please visit the following link to claim your information: ${input.claimUrl}`;
  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #0B1C2C;">You have a pending Aegis claim</h2>
      <p style="color: #4A6B8A;">Someone has designated you as a recipient in their Aegis DMS release.</p>
      <a href="${input.claimUrl}" style="display: inline-block; background: #0B1C2C; color: #DDE8F4; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">
        Claim your information
      </a>
      <p style="color: #8AAAC8; font-size: 12px;">If you were not expecting this, you can safely ignore this message.</p>
    </div>
  `;

  await sendContactClaimNotification(ctx, {
    userId: input.userId,
    contactId: input.contactId,
    releaseRunId: input.releaseRunId,
    contactClaimId: input.contactClaimId,
    toEmail: input.toEmail,
    toTelegramHandle: input.toTelegramHandle,
    subject,
    htmlBody,
    textBody,
    claimUrl: input.claimUrl,
  });
}
