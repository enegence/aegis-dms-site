import type { AegisDb } from '../db/index.js';
import { relayConnections, users } from '../db/schema.js';
import { eq, and, lte, ne, isNotNull } from 'drizzle-orm';
import { sendEmail } from './email.js';
import { writeAuditEvent } from './audit.js';
import { writeNotificationEvent } from './notification-events.js';

export interface RelayMonitorResult {
  checked: number;
  markedOffline: number;
  alertsSent: number;
  errors: number;
}

const GRACE_MINUTES = parseInt(process.env.AEGIS_RELAY_OFFLINE_GRACE_MINUTES ?? '10', 10);

function sanitizeFailureReason(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[redacted]').slice(0, 200);
}

const ALERT_EMAIL_SUBJECT = 'Aegis Relay has not heard from your self-hosted instance';
const ALERT_EMAIL_BODY = `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
  <h1 style="font-size: 24px; color: #0B1C2C;">Aegis Relay Alert</h1>
  <p style="color: #4A6B8A; line-height: 1.6;">Your Aegis Core instance missed its expected heartbeat. Relay Monitoring increases awareness, but final release may still depend on your local host unless Relay Escrow is configured.</p>
  <p style="color: #8AAAC8; font-size: 12px;">This alert was sent because your relay connection reported no heartbeat within the expected window.</p>
</div>`;

const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function runRelayMonitorOnce(
  db: AegisDb,
  postmarkApiToken: string,
  fromEmail: string,
  now?: Date,
): Promise<RelayMonitorResult> {
  const effectiveNow = now ?? new Date();
  const offlineThreshold = new Date(effectiveNow.getTime() - GRACE_MINUTES * 60 * 1000);

  const result: RelayMonitorResult = {
    checked: 0,
    markedOffline: 0,
    alertsSent: 0,
    errors: 0,
  };

  // Query overdue connections (not already disconnected, with lastExpectedHeartbeatAt set and past threshold)
  let overdueConnections: Array<typeof relayConnections.$inferSelect>;
  try {
    overdueConnections = await db
      .select()
      .from(relayConnections)
      .where(
        and(
          ne(relayConnections.status, 'disconnected'),
          isNotNull(relayConnections.lastExpectedHeartbeatAt),
          lte(relayConnections.lastExpectedHeartbeatAt, offlineThreshold),
        ),
      );
  } catch (err) {
    console.error('[relay-monitor] Failed to query overdue connections:', err);
    result.errors++;
    return result;
  }

  result.checked = overdueConnections.length;

  for (const connection of overdueConnections) {
    try {
      // Mark connection as offline
      await db
        .update(relayConnections)
        .set({ status: 'offline', updatedAt: effectiveNow })
        .where(eq(relayConnections.id, connection.id));

      result.markedOffline++;

      // Spam prevention: skip if already alerted within last 24h
      if (
        connection.offlineAlertSentAt !== null &&
        connection.offlineAlertSentAt !== undefined &&
        effectiveNow.getTime() - connection.offlineAlertSentAt.getTime() < ALERT_COOLDOWN_MS
      ) {
        // Already alerted recently — skip
        continue;
      }

      // Look up owner email
      const userRows = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, connection.userId));

      if (userRows.length === 0) {
        console.warn('[relay-monitor] No user found for connection', connection.id);
        result.errors++;
        continue;
      }

      const ownerEmail = userRows[0].email;

      try {
        await sendEmail(postmarkApiToken, fromEmail, ownerEmail, ALERT_EMAIL_SUBJECT, ALERT_EMAIL_BODY);

        // Update offlineAlertSentAt
        await db
          .update(relayConnections)
          .set({ offlineAlertSentAt: effectiveNow, updatedAt: effectiveNow })
          .where(eq(relayConnections.id, connection.id));

        await writeNotificationEvent(db, {
          userId: connection.userId,
          relayConnectionId: connection.id,
          channel: 'email',
          purpose: 'relay_offline_alert',
          status: 'sent',
          sentAt: effectiveNow,
        });

        await writeAuditEvent(db, {
          eventType: 'relay_offline_detected',
          actorType: 'system',
          userId: connection.userId,
          relayConnectionId: connection.id,
          metadata: { connectionId: connection.id },
        });

        result.alertsSent++;
      } catch (emailErr) {
        const failureReason = sanitizeFailureReason(emailErr);

        await writeNotificationEvent(db, {
          userId: connection.userId,
          relayConnectionId: connection.id,
          channel: 'email',
          purpose: 'relay_offline_alert',
          status: 'failed',
          failureReason,
        });

        await writeAuditEvent(db, {
          eventType: 'relay_alert_failed',
          actorType: 'system',
          userId: connection.userId,
          relayConnectionId: connection.id,
          metadata: { connectionId: connection.id },
        });

        result.errors++;
      }
    } catch (err) {
      console.error('[relay-monitor] Error processing connection', connection.id, err);
      result.errors++;
    }
  }

  return result;
}
