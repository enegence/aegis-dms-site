import { eq, and, ne } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';
import type { AegisDb } from '../db/index.js';
import { relayConnections } from '../db/schema.js';

function generateApiKey(): string {
  return 'rlk_' + randomBytes(32).toString('hex');
}

function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

export async function createRelayConnection(
  db: AegisDb,
  userId: string,
  input: { label?: string | null; mode?: string },
): Promise<{ connection: typeof relayConnections.$inferSelect; rawApiKey: string }> {
  const rawApiKey = generateApiKey();
  const apiKeyHash = hashApiKey(rawApiKey);
  const [connection] = await db.insert(relayConnections).values({
    userId,
    apiKeyHash,
    label: input.label ?? null,
    mode: input.mode ?? 'relay_monitoring',
    status: 'active',
  }).returning();
  return { connection, rawApiKey };
}

export async function listRelayConnections(
  db: AegisDb,
  userId: string,
): Promise<Array<typeof relayConnections.$inferSelect>> {
  return db.select().from(relayConnections)
    .where(and(eq(relayConnections.userId, userId), eq(relayConnections.status, 'active')));
  // Note: revoked connections are excluded from listing
}

export async function getRelayConnection(
  db: AegisDb,
  userId: string,
  id: string,
): Promise<typeof relayConnections.$inferSelect | null> {
  const [conn] = await db.select().from(relayConnections)
    .where(and(eq(relayConnections.id, id), eq(relayConnections.userId, userId)));
  return conn ?? null;
}

export async function updateRelayConnection(
  db: AegisDb,
  userId: string,
  id: string,
  input: { label?: string | null },
): Promise<typeof relayConnections.$inferSelect | null> {
  const [updated] = await db.update(relayConnections)
    .set({ label: input.label ?? null, updatedAt: new Date() })
    .where(and(eq(relayConnections.id, id), eq(relayConnections.userId, userId)))
    .returning();
  return updated ?? null;
}

export async function rotateRelayKey(
  db: AegisDb,
  userId: string,
  id: string,
): Promise<{ connection: typeof relayConnections.$inferSelect; rawApiKey: string } | null> {
  const rawApiKey = generateApiKey();
  const apiKeyHash = hashApiKey(rawApiKey);
  const [updated] = await db.update(relayConnections)
    .set({ apiKeyHash, updatedAt: new Date() })
    .where(
      and(
        eq(relayConnections.id, id),
        eq(relayConnections.userId, userId),
        // Cannot rotate a revoked connection
        ne(relayConnections.status, 'disconnected'),
      )
    )
    .returning();
  if (!updated) return null;
  return { connection: updated, rawApiKey };
}

export async function revokeRelayConnection(
  db: AegisDb,
  userId: string,
  id: string,
): Promise<boolean> {
  const [updated] = await db.update(relayConnections)
    .set({ status: 'disconnected', revokedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(relayConnections.id, id), eq(relayConnections.userId, userId)))
    .returning();
  return !!updated;
}

export async function deleteRelayConnection(
  db: AegisDb,
  userId: string,
  id: string,
): Promise<{ deleted: boolean; action: 'deleted' | 'revoked' } | null> {
  // Hard delete only if never sent a heartbeat (no relay history)
  const [conn] = await db.select().from(relayConnections)
    .where(and(eq(relayConnections.id, id), eq(relayConnections.userId, userId)));
  if (!conn) return null;
  if (conn.lastHeartbeatAt !== null) {
    // Has relay history — revoke instead of delete
    await revokeRelayConnection(db, userId, id);
    return { deleted: true, action: 'revoked' };
  }
  await db.delete(relayConnections)
    .where(and(eq(relayConnections.id, id), eq(relayConnections.userId, userId)));
  return { deleted: true, action: 'deleted' };
}

export { hashApiKey };
