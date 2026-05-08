import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { relayConnections } from '../db/schema.js';
import { hashApiKey } from './relay-connections.js';

export type RelayAuthResult =
  | { ok: true; connection: typeof relayConnections.$inferSelect }
  | { ok: false; reason: 'missing' | 'invalid' | 'revoked' };

export async function authenticateRelayKey(
  db: PostgresJsDatabase<typeof schema>,
  authHeader: string | undefined
): Promise<RelayAuthResult> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, reason: 'missing' };
  }

  const rawKey = authHeader.slice('Bearer '.length);
  const keyHash = hashApiKey(rawKey);

  const [connection] = await db.select().from(relayConnections)
    .where(eq(relayConnections.apiKeyHash, keyHash));

  if (!connection) {
    return { ok: false, reason: 'invalid' };
  }

  if (connection.status === 'disconnected') {
    return { ok: false, reason: 'revoked' };
  }

  return { ok: true, connection };
}
