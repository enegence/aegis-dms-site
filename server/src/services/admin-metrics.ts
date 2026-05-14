import { count, eq, and, gte, inArray } from 'drizzle-orm';
import type { AegisDb } from '../db/index.js';
import {
  users,
  subscriptions,
  relayConnections,
  releaseRuns,
  packets,
  notificationEvents,
  switches,
  workerHeartbeats,
} from '../db/schema.js';
import { getActiveAlerts, type Alert } from './alerts.js';

export interface AdminMetrics {
  totalUsers: number;
  verifiedUsers: number;
  activeSubscriptions: number;
  relayConnectionsActive: number;
  relayConnectionsOffline: number;
  switchesArmed: number;
  switchesWarning: number;
  switchesTriggered: number;
  activeReleaseRuns: number;
  packetsStored: number;
  notificationFailuresLast24h: number;
  // Phase 5 Task 5 additions
  workerLastTickAt: string | null;
  workerStatus: 'ok' | 'degraded' | 'unknown';
  recentAlerts: Alert[];
}

export async function getAdminMetrics(db: AegisDb): Promise<AdminMetrics> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const now = new Date();

  const [
    [totalUsersRow], [verifiedUsersRow], [activeSubsRow],
    [activeConnsRow], [offlineConnsRow],
    [armedRow], [warningRow], [triggeredRow],
    [activeRunsRow], [packetsRow], [failuresRow],
  ] = await Promise.all([
    db.select({ c: count() }).from(users),
    db.select({ c: count() }).from(users).where(eq(users.emailVerified, true)),
    db.select({ c: count() }).from(subscriptions).where(eq(subscriptions.status, 'active')),
    db.select({ c: count() }).from(relayConnections).where(eq(relayConnections.status, 'active')),
    db.select({ c: count() }).from(relayConnections).where(eq(relayConnections.status, 'offline')),
    db.select({ c: count() }).from(switches).where(eq(switches.status, 'armed')),
    db.select({ c: count() }).from(switches).where(eq(switches.status, 'warning')),
    db.select({ c: count() }).from(switches).where(eq(switches.status, 'triggered')),
    db.select({ c: count() }).from(releaseRuns).where(
      inArray(releaseRuns.status, ['active', 'active_pending_packet', 'cascade_active', 'pending']),
    ),
    db.select({ c: count() }).from(packets),
    db.select({ c: count() }).from(notificationEvents).where(
      and(
        eq(notificationEvents.status, 'failed'),
        gte(notificationEvents.createdAt, since24h),
      ),
    ),
  ]);

  // Worker heartbeat status
  let workerLastTickAt: string | null = null;
  let workerStatus: 'ok' | 'degraded' | 'unknown' = 'unknown';
  try {
    const [hb] = await db
      .select()
      .from(workerHeartbeats)
      .where(eq(workerHeartbeats.id, 'singleton'));

    if (hb?.lastTickAt) {
      workerLastTickAt = hb.lastTickAt.toISOString();
      const staleMs = parseInt(process.env.ALERT_WORKER_STALE_MINUTES ?? '10', 10) * 60 * 1000;
      const msSince = now.getTime() - hb.lastTickAt.getTime();
      workerStatus = msSince <= staleMs ? 'ok' : 'degraded';
    }
  } catch {
    // Table may not exist
  }

  // Recent alerts
  let recentAlerts: Alert[] = [];
  try {
    recentAlerts = await getActiveAlerts(db);
  } catch {
    // Non-fatal
  }

  return {
    totalUsers: Number(totalUsersRow!.c),
    verifiedUsers: Number(verifiedUsersRow!.c),
    activeSubscriptions: Number(activeSubsRow!.c),
    relayConnectionsActive: Number(activeConnsRow!.c),
    relayConnectionsOffline: Number(offlineConnsRow!.c),
    switchesArmed: Number(armedRow!.c),
    switchesWarning: Number(warningRow!.c),
    switchesTriggered: Number(triggeredRow!.c),
    activeReleaseRuns: Number(activeRunsRow!.c),
    packetsStored: Number(packetsRow!.c),
    notificationFailuresLast24h: Number(failuresRow!.c),
    workerLastTickAt,
    workerStatus,
    recentAlerts,
  };
}
