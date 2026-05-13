import { count, eq, and, gte, inArray } from 'drizzle-orm';
import type { AegisDb } from '../db/index.js';
import {
  users,
  subscriptions,
  relayConnections,
  releaseRuns,
  packets,
  notificationEvents,
} from '../db/schema.js';

export interface AdminMetrics {
  totalUsers: number;
  verifiedUsers: number;
  activeSubscriptions: number;
  relayConnectionsActive: number;
  relayConnectionsOffline: number;
  activeReleaseRuns: number;
  packetsStored: number;
  notificationFailuresLast24h: number;
}

export async function getAdminMetrics(db: AegisDb): Promise<AdminMetrics> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [[totalUsersRow], [verifiedUsersRow], [activeSubsRow],
    [activeConnsRow], [offlineConnsRow], [activeRunsRow],
    [packetsRow], [failuresRow]] = await Promise.all([
    db.select({ c: count() }).from(users),
    db.select({ c: count() }).from(users).where(eq(users.emailVerified, true)),
    db.select({ c: count() }).from(subscriptions).where(eq(subscriptions.status, 'active')),
    db.select({ c: count() }).from(relayConnections).where(eq(relayConnections.status, 'active')),
    db.select({ c: count() }).from(relayConnections).where(eq(relayConnections.status, 'offline')),
    db.select({ c: count() }).from(releaseRuns).where(
      and(
        inArray(releaseRuns.status, ['active', 'pending']),
      ),
    ),
    db.select({ c: count() }).from(packets),
    db.select({ c: count() }).from(notificationEvents).where(
      and(
        eq(notificationEvents.status, 'failed'),
        gte(notificationEvents.createdAt, since24h),
      ),
    ),
  ]);

  return {
    totalUsers: Number(totalUsersRow!.c),
    verifiedUsers: Number(verifiedUsersRow!.c),
    activeSubscriptions: Number(activeSubsRow!.c),
    relayConnectionsActive: Number(activeConnsRow!.c),
    relayConnectionsOffline: Number(offlineConnsRow!.c),
    activeReleaseRuns: Number(activeRunsRow!.c),
    packetsStored: Number(packetsRow!.c),
    notificationFailuresLast24h: Number(failuresRow!.c),
  };
}
