import type { AegisDb } from '../db/index.js';
import { notificationEvents } from '../db/schema.js';

export async function writeNotificationEvent(
  db: AegisDb,
  input: {
    userId?: string | null;
    relayConnectionId?: string | null;
    switchId?: string | null;
    contactId?: string | null;
    channel: string;
    purpose: string;
    status: 'sent' | 'failed' | 'skipped';
    externalId?: string | null;
    failureReason?: string | null;
    sentAt?: Date | null;
  },
): Promise<void> {
  try {
    await db.insert(notificationEvents).values({
      userId: input.userId ?? null,
      relayConnectionId: input.relayConnectionId ?? null,
      switchId: input.switchId ?? null,
      contactId: input.contactId ?? null,
      channel: input.channel,
      purpose: input.purpose,
      status: input.status,
      externalId: input.externalId ?? null,
      failureReason: input.failureReason ?? null,
      sentAt: input.sentAt ?? null,
    });
  } catch (err) {
    console.error('[notification-events] Failed to write notification event:', input.purpose, err);
  }
}
