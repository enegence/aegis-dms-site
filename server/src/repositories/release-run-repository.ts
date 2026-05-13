import type { AegisDb } from '../db/index.js';
import { releaseRuns } from '../db/schema.js';
import { eq, and, ne } from 'drizzle-orm';

export type ReleaseRun = typeof releaseRuns.$inferSelect;

export async function getActiveReleaseRunForUser(
  db: AegisDb,
  userId: string,
): Promise<ReleaseRun | null> {
  const rows = await db
    .select()
    .from(releaseRuns)
    .where(
      and(
        eq(releaseRuns.userId, userId),
        ne(releaseRuns.status, 'completed'),
        ne(releaseRuns.status, 'cancelled'),
        ne(releaseRuns.status, 'failed'),
      ),
    );
  return rows[0] ?? null;
}

export async function getReleaseRunById(
  db: AegisDb,
  id: string,
): Promise<ReleaseRun | null> {
  const rows = await db
    .select()
    .from(releaseRuns)
    .where(eq(releaseRuns.id, id));
  return rows[0] ?? null;
}

export interface CreateReleaseRunInput {
  userId: string;
  triggeringSwitchId?: string | null;
  relayConnectionId?: string | null;
  activePacketId?: string | null;
  source: 'hosted' | 'relay_escrow';
  status?: string;
}

export async function createReleaseRun(
  db: AegisDb,
  input: CreateReleaseRunInput,
): Promise<ReleaseRun> {
  const rows = await db
    .insert(releaseRuns)
    .values({
      userId: input.userId,
      triggeringSwitchId: input.triggeringSwitchId ?? null,
      relayConnectionId: input.relayConnectionId ?? null,
      activePacketId: input.activePacketId ?? null,
      source: input.source,
      status: input.status ?? 'active',
    })
    .returning();
  return rows[0]!;
}

export interface UpdateReleaseRunInput {
  status?: string;
  activePacketId?: string | null;
  currentContactClaimId?: string | null;
  suppressedSwitchIds?: string[];
  completedAt?: Date | null;
  cancelledAt?: Date | null;
}

export async function updateReleaseRun(
  db: AegisDb,
  id: string,
  patch: UpdateReleaseRunInput,
): Promise<ReleaseRun | null> {
  const rows = await db
    .update(releaseRuns)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(releaseRuns.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function appendSuppressedSwitchId(
  db: AegisDb,
  runId: string,
  switchId: string,
): Promise<void> {
  const run = await getReleaseRunById(db, runId);
  if (!run) return;

  const current = Array.isArray(run.suppressedSwitchIds)
    ? (run.suppressedSwitchIds as string[])
    : [];

  if (current.includes(switchId)) return;

  await db
    .update(releaseRuns)
    .set({ suppressedSwitchIds: [...current, switchId], updatedAt: new Date() })
    .where(eq(releaseRuns.id, runId));
}
