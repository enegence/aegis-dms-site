import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema.js';
import type { Heartbeat } from '@aegis-site/contracts';
import { eq } from 'drizzle-orm';
import { relayConnections } from '../db/schema.js';

const DEFAULT_INTERVAL_HOURS = parseInt(process.env.AEGIS_RELAY_DEFAULT_INTERVAL_HOURS ?? '24', 10);

export async function recordHeartbeat(
  db: PostgresJsDatabase<typeof schema>,
  connectionId: string,
  heartbeat: Heartbeat
): Promise<typeof relayConnections.$inferSelect> {
  const baseTime = new Date(heartbeat.timestamp);

  let lastExpectedHeartbeatAt: Date;
  const intervalSeconds = heartbeat.metadata?.heartbeatIntervalSeconds;
  if (typeof intervalSeconds === 'number') {
    lastExpectedHeartbeatAt = new Date(baseTime.getTime() + intervalSeconds * 1000);
  } else {
    lastExpectedHeartbeatAt = new Date(baseTime.getTime() + DEFAULT_INTERVAL_HOURS * 3600 * 1000);
  }

  const now = new Date();
  const [updated] = await db.update(relayConnections)
    .set({
      lastHeartbeatAt: now,
      lastExpectedHeartbeatAt,
      lastHeartbeatData: heartbeat as unknown as Record<string, unknown>,
      status: 'active',
      updatedAt: now,
    })
    .where(eq(relayConnections.id, connectionId))
    .returning();

  return updated;
}
