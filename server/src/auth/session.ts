import { nanoid } from 'nanoid';
import { eq, lt } from 'drizzle-orm';
import { sessions } from '../db/schema.js';
import type { AegisDb } from '../db/index.js';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for SaaS

export async function createSession(db: AegisDb, userId: string): Promise<string> {
  const id = nanoid(48);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  await db.insert(sessions).values({
    id,
    userId,
    expiresAt,
    createdAt: now,
  });

  return id;
}

export async function validateSession(db: AegisDb, sessionId: string): Promise<string | null> {
  const [result] = await db.select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!result) return null;
  if (result.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  return result.userId;
}

export async function deleteSession(db: AegisDb, sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function cleanExpiredSessions(db: AegisDb): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
