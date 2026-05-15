/**
 * Operational alerting service (Phase 5 Task 5 + Task 11).
 *
 * Reads DB state to determine if any operational conditions require attention.
 * Task 5: getActiveAlerts — detection only.
 * Task 11: sendOperatorAlerts — detection + email dispatch.
 *
 * Alert shapes contain no PII — only system-level operational data.
 */

import { eq, count, and, lte, inArray } from 'drizzle-orm';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
import type { AegisDb } from '../db/index.js';
import { workerHeartbeats, notificationDeliveries, releaseRuns } from '../db/schema.js';
import { sendEmailStructured } from './email.js';

export interface Alert {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string; // no PII
  raisedAt: Date;
}

// Thresholds (can be env-overridden)
const WORKER_STALE_MINUTES = parseInt(process.env.ALERT_WORKER_STALE_MINUTES ?? '10', 10);
const FAILED_NOTIFICATION_THRESHOLD = parseInt(process.env.ALERT_FAILED_NOTIFICATION_COUNT ?? '5', 10);
const STUCK_RELEASE_RUN_HOURS = parseInt(process.env.ALERT_STUCK_RELEASE_RUN_HOURS ?? '24', 10);

/**
 * Returns active operational alerts derived from current DB state.
 * No in-memory state — all conditions evaluated from DB on each call.
 */
export async function getActiveAlerts(db: AegisDb): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const now = new Date();

  // ── 1. Worker heartbeat staleness ────────────────────────────────────────────
  try {
    const [heartbeat] = await db
      .select()
      .from(workerHeartbeats)
      .where(eq(workerHeartbeats.id, 'singleton'));

    if (!heartbeat || heartbeat.lastTickAt == null) {
      alerts.push({
        type: 'worker_never_ticked',
        severity: 'warning',
        message: 'Worker has never recorded a heartbeat. Worker may not be running.',
        raisedAt: now,
      });
    } else {
      const staleMs = WORKER_STALE_MINUTES * 60 * 1000;
      const msSinceLastTick = now.getTime() - heartbeat.lastTickAt.getTime();
      if (msSinceLastTick > staleMs) {
        const minutesAgo = Math.floor(msSinceLastTick / 60000);
        alerts.push({
          type: 'worker_stale',
          severity: 'critical',
          message: `Worker last ticked ${minutesAgo} minutes ago (threshold: ${WORKER_STALE_MINUTES} minutes).`,
          raisedAt: now,
        });
      }
    }
  } catch {
    // Table may not exist yet (fresh install before migration)
  }

  // ── 2. Failed notification threshold ─────────────────────────────────────────
  try {
    const [failRow] = await db
      .select({ c: count() })
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.status, 'failed_permanent'));

    const failCount = Number(failRow?.c ?? 0);
    if (failCount >= FAILED_NOTIFICATION_THRESHOLD) {
      alerts.push({
        type: 'notification_failures_threshold',
        severity: 'warning',
        message: `${failCount} permanent notification delivery failures (threshold: ${FAILED_NOTIFICATION_THRESHOLD}).`,
        raisedAt: now,
      });
    }
  } catch {
    // Table may not exist
  }

  // ── 3. Stuck release runs ─────────────────────────────────────────────────────
  try {
    const stuckThreshold = new Date(now.getTime() - STUCK_RELEASE_RUN_HOURS * 60 * 60 * 1000);
    const [stuckRow] = await db
      .select({ c: count() })
      .from(releaseRuns)
      .where(
        and(
          inArray(releaseRuns.status, ['active', 'cascade_active', 'active_pending_packet']),
          lte(releaseRuns.startedAt, stuckThreshold),
        ),
      );

    const stuckCount = Number(stuckRow?.c ?? 0);
    if (stuckCount > 0) {
      alerts.push({
        type: 'stuck_release_run',
        severity: 'critical',
        message: `${stuckCount} release run(s) active for more than ${STUCK_RELEASE_RUN_HOURS} hours.`,
        raisedAt: now,
      });
    }
  } catch {
    // Table may not exist
  }

  return alerts;
}

// ── Operator alert sending (Task 11) ─────────────────────────────────────────

/**
 * Minute-level deduplication set.
 * Key format: `${alert.type}:${raisedAt.toISOString().slice(0, 16)}`
 * Resets on module reload — acceptable for beta.
 * Capped at 1000 entries to prevent unbounded growth.
 */
const _sentAlertKeys = new Set<string>();

function addSentAlertKey(key: string): void {
  if (_sentAlertKeys.size >= 1000) {
    _sentAlertKeys.clear();
  }
  _sentAlertKeys.add(key);
}

/**
 * Detects active alerts via getActiveAlerts and emails each one to the operator.
 * Uses minute-level deduplication to suppress repeated sends within the same minute.
 * If postmarkApiToken is empty, logs to console and skips send (stub mode).
 * Individual send errors are caught and logged — does not throw.
 */
export async function sendOperatorAlerts(
  db: AegisDb,
  opts: {
    operatorEmail: string;
    fromEmail: string;
    postmarkApiToken: string;
    baseUrl: string;
  },
): Promise<void> {
  let alerts: Alert[];
  try {
    alerts = await getActiveAlerts(db);
  } catch (err) {
    console.error('[alerts] Failed to fetch active alerts:', err);
    return;
  }

  if (alerts.length === 0) return;

  for (const alert of alerts) {
    if (alert.severity === 'info') continue; // only critical + warning go to operator

    const dedupeKey = `${alert.type}:${alert.raisedAt.toISOString().slice(0, 16)}`;
    if (_sentAlertKeys.has(dedupeKey)) {
      continue; // already sent this alert in this minute
    }

    const subject = `[Aegis Alert] ${alert.type} — ${alert.severity}`;
    const textBody =
      `Aegis DMS Operator Alert\n\n` +
      `Type: ${alert.type}\n` +
      `Severity: ${alert.severity}\n` +
      `Message: ${alert.message}\n` +
      `Raised at: ${alert.raisedAt.toISOString()}\n\n` +
      `---\nThis is an automated operational alert. No user PII is included.`;
    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${subject}</title></head>
<body style="font-family:sans-serif;max-width:500px;margin:40px auto;padding:0 16px;">
  <div style="background:#0B1C2C;padding:16px 20px;border-radius:6px 6px 0 0;">
    <span style="font-size:16px;font-weight:700;color:#DDE8F4;">Aegis DMS — Operator Alert</span>
  </div>
  <div style="background:#fff;padding:24px 20px;border:1px solid #DDE8F4;border-top:none;border-radius:0 0 6px 6px;">
    <table style="border-collapse:collapse;width:100%;font-size:14px;color:#0B1C2C;">
      <tr><td style="padding:6px 0;color:#4A6B8A;width:100px;"><strong>Type</strong></td><td style="padding:6px 0;">${escapeHtml(alert.type)}</td></tr>
      <tr><td style="padding:6px 0;color:#4A6B8A;"><strong>Severity</strong></td><td style="padding:6px 0;">${escapeHtml(alert.severity)}</td></tr>
      <tr><td style="padding:6px 0;color:#4A6B8A;"><strong>Message</strong></td><td style="padding:6px 0;">${escapeHtml(alert.message)}</td></tr>
      <tr><td style="padding:6px 0;color:#4A6B8A;"><strong>Raised at</strong></td><td style="padding:6px 0;">${alert.raisedAt.toISOString()}</td></tr>
    </table>
    <p style="font-size:11px;color:#8AAAC8;margin-top:20px;">This is an automated operational alert. No user PII is included.</p>
  </div>
</body>
</html>`.trim();

    if (!opts.postmarkApiToken) {
      console.log(`[alerts-stub] Would send operator alert: ${subject} — ${alert.message}`);
      addSentAlertKey(dedupeKey);
      continue;
    }

    try {
      const result = await sendEmailStructured(opts.postmarkApiToken, {
        from: opts.fromEmail,
        to: opts.operatorEmail,
        subject,
        htmlBody,
        textBody,
      });
      if (result.error) {
        console.error(`[alerts] Failed to send operator alert for ${alert.type}: ${result.error}`);
      } else {
        addSentAlertKey(dedupeKey);
      }
    } catch (err) {
      console.error(`[alerts] Unexpected error sending operator alert for ${alert.type}:`, err);
    }
  }
}
