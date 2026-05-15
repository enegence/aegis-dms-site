/**
 * Postmark event ingestion service (SaaS).
 *
 * Handles inbound Postmark webhook events and updates notification_deliveries rows.
 *
 * Supported events:
 *  - Delivery: mark delivery as 'delivered'
 *  - Bounce (HardBounce, Unsubscribe): mark as 'failed_permanent'
 *  - Bounce (soft): mark as 'failed_retryable'
 *  - SpamComplaint: mark as 'failed_permanent'
 *  - Open: log only, no state change
 *
 * Idempotent: duplicate events for the same MessageID produce no extra DB writes.
 *
 * Security:
 *  - Webhook auth checked by the route handler (POSTMARK_WEBHOOK_TOKEN header).
 *  - No PII is logged or stored here beyond what's already in notification_deliveries.
 */

import type { AegisDb } from '../db/index.js';
import {
  markDelivered,
  markPermanentFailureByMessageId,
  markRetryableFailureByMessageId,
} from './notification-delivery.js';

export interface PostmarkDeliveryEvent {
  RecordType: 'Delivery';
  MessageID: string;
  Recipient?: string;
  DeliveredAt?: string;
}

export interface PostmarkBounceEvent {
  RecordType: 'Bounce';
  MessageID: string;
  Type: string;      // 'HardBounce', 'SoftBounce', 'Unsubscribe', etc.
  TypeCode?: number;
  Description?: string;
}

export interface PostmarkSpamComplaintEvent {
  RecordType: 'SpamComplaint';
  MessageID: string;
}

export interface PostmarkOpenEvent {
  RecordType: 'Open';
  MessageID: string;
}

export type PostmarkEvent =
  | PostmarkDeliveryEvent
  | PostmarkBounceEvent
  | PostmarkSpamComplaintEvent
  | PostmarkOpenEvent;

export interface IngestResult {
  handled: boolean;
  action: 'delivered' | 'failed_permanent' | 'failed_retryable' | 'logged_open' | 'ignored';
  messageId: string;
}

/**
 * Process a single Postmark webhook event.
 * Returns a structured result indicating what action was taken.
 */
export async function ingestPostmarkEvent(
  db: AegisDb,
  event: PostmarkEvent,
): Promise<IngestResult> {
  switch (event.RecordType) {
    case 'Delivery': {
      const messageId = event.MessageID;
      if (!messageId) {
        return { handled: false, action: 'ignored', messageId: '' };
      }
      await markDelivered(db, messageId);
      return { handled: true, action: 'delivered', messageId };
    }

    case 'Bounce': {
      const messageId = event.MessageID;
      if (!messageId) {
        return { handled: false, action: 'ignored', messageId: '' };
      }

      const bounceType = (event as PostmarkBounceEvent).Type ?? '';
      const isPermanent =
        bounceType === 'HardBounce' ||
        bounceType === 'Unsubscribe' ||
        bounceType === 'ManuallyDeactivated' ||
        bounceType === 'DnsError' ||
        bounceType === 'SpamNotification' ||
        bounceType === 'BadEmailAddress' ||
        bounceType === 'AddressChange';

      if (isPermanent) {
        await markPermanentFailureByMessageId(db, messageId, `bounce_${bounceType.toLowerCase()}`);
        return { handled: true, action: 'failed_permanent', messageId };
      } else {
        await markRetryableFailureByMessageId(db, messageId, `bounce_${bounceType.toLowerCase()}`);
        return { handled: true, action: 'failed_retryable', messageId };
      }
    }

    case 'SpamComplaint': {
      const messageId = event.MessageID;
      if (!messageId) {
        return { handled: false, action: 'ignored', messageId: '' };
      }
      await markPermanentFailureByMessageId(db, messageId, 'spam_complaint');
      return { handled: true, action: 'failed_permanent', messageId };
    }

    case 'Open': {
      // Log only — do not change delivery state
      return { handled: true, action: 'logged_open', messageId: event.MessageID ?? '' };
    }

    default: {
      return { handled: false, action: 'ignored', messageId: '' };
    }
  }
}
