/**
 * Notification event repository.
 *
 * Security invariant: recipientRef MUST be a contactId (UUID) or other
 * non-PII reference. Plaintext email addresses, phone numbers, and Telegram
 * handles are NEVER stored here.
 */

import type { AegisDb } from '../db/index.js';
import { notificationEvents } from '../db/schema.js';

export interface CreateNotificationEventInput {
  userId?: string | null;
  releaseRunId?: string | null;
  contactClaimId?: string | null;
  channel: 'email' | 'telegram';
  provider: 'postmark' | 'telegram';
  /** contactId (UUID) or other non-PII reference — never a plaintext address */
  recipientRef: string;
  status: 'sent' | 'failed' | 'skipped';
  providerMessageId?: string | null;
  errorCode?: string | null;
  errorMessageRedacted?: string | null;
}

export async function createNotificationEvent(
  db: AegisDb,
  input: CreateNotificationEventInput,
): Promise<void> {
  try {
    await db.insert(notificationEvents).values({
      userId: input.userId ?? null,
      releaseRunId: input.releaseRunId ?? null,
      contactClaimId: input.contactClaimId ?? null,
      // Legacy fields that are NOT NULL in the schema — fill with safe defaults
      channel: input.channel,
      purpose: `${input.provider}_dispatch`,
      provider: input.provider,
      recipientRef: input.recipientRef,
      status: input.status,
      providerMessageId: input.providerMessageId ?? null,
      errorCode: input.errorCode ?? null,
      errorMessageRedacted: input.errorMessageRedacted ?? null,
      sentAt: input.status === 'sent' ? new Date() : null,
    });
  } catch (err) {
    // Log the error but never re-throw — notification logging must not break
    // the surrounding dispatch flow. Log only the status and provider, not any
    // recipient or message details.
    console.error(
      '[notification-event-repository] Failed to write event:',
      input.provider,
      input.status,
      err,
    );
  }
}
