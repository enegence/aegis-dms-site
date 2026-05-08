import type { AegisDb } from '../db/index.js';
import { switches, releaseRuns } from '../db/schema.js';
import { eq, and, ne, inArray } from 'drizzle-orm';

// Valid status values
type SwitchStatus = 'draft' | 'armed' | 'warning' | 'triggered' | 'paused' | 'cancelled' | 'completed';

export async function listSwitches(db: AegisDb, userId: string) {
  return db.select().from(switches).where(eq(switches.userId, userId));
}

export async function getSwitch(db: AegisDb, userId: string, switchId: string) {
  const rows = await db
    .select()
    .from(switches)
    .where(and(eq(switches.id, switchId), eq(switches.userId, userId)));
  return rows[0] ?? null;
}

export async function createSwitch(
  db: AegisDb,
  userId: string,
  input: {
    name: string;
    mode: string;
    triggerAt?: string | null;
    heartbeatIntervalDays?: number | null;
    gracePeriodHours: number;
    warningWindowDays: number;
    selectedContactIds: string[];
    selectedEstateItemIds: string[];
  },
) {
  const rows = await db
    .insert(switches)
    .values({
      userId,
      name: input.name,
      mode: input.mode,
      triggerAt: input.triggerAt ? new Date(input.triggerAt) : null,
      heartbeatIntervalDays: input.heartbeatIntervalDays ?? null,
      gracePeriodHours: input.gracePeriodHours,
      warningWindowDays: input.warningWindowDays,
      selectedContactIds: input.selectedContactIds,
      selectedEstateItemIds: input.selectedEstateItemIds,
    })
    .returning();
  return rows[0]!;
}

export async function updateSwitch(
  db: AegisDb,
  userId: string,
  switchId: string,
  patch: Record<string, unknown>,
) {
  const rows = await db
    .update(switches)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(switches.id, switchId), eq(switches.userId, userId)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteSwitch(db: AegisDb, userId: string, switchId: string) {
  const rows = await db
    .delete(switches)
    .where(and(eq(switches.id, switchId), eq(switches.userId, userId)))
    .returning();
  return { deleted: rows.length > 0 };
}

export async function getActiveReleaseRun(db: AegisDb, userId: string) {
  const rows = await db
    .select()
    .from(releaseRuns)
    .where(
      and(
        eq(releaseRuns.userId, userId),
        ne(releaseRuns.status, 'completed'),
        ne(releaseRuns.status, 'cancelled'),
      ),
    );
  return rows[0] ?? null;
}

export async function createReleaseRun(
  db: AegisDb,
  userId: string,
  triggeringSwitchId: string,
  initialStatus: string = 'active_pending_packet',
) {
  const rows = await db
    .insert(releaseRuns)
    .values({
      userId,
      triggeringSwitchId,
      status: initialStatus,
    })
    .returning();
  return rows[0]!;
}

export async function markSwitchStatus(
  db: AegisDb,
  userId: string,
  switchId: string,
  status: SwitchStatus,
  patch: Record<string, unknown> = {},
) {
  const rows = await db
    .update(switches)
    .set({ status, updatedAt: new Date(), ...patch })
    .where(and(eq(switches.id, switchId), eq(switches.userId, userId)))
    .returning();
  return rows[0] ?? null;
}
