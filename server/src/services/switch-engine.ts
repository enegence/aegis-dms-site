import type { AegisDb } from '../db/index.js';
import * as repo from './switch-repository.js';
import { writeAuditEvent } from './audit.js';

// Arm a switch (draft → armed)
// Validates: status must be 'draft' or 'paused'
// For trip mode: computes warningStartsAt = triggerAt - warningWindowDays * 86400000
// For heartbeat mode: computes nextCheckInDueAt = now + heartbeatIntervalDays * 86400000
// Updates status='armed', sets computed timestamps, sets updatedAt
// Writes audit: switch_armed { switchId }
// Returns updated switch
export async function armSwitch(db: AegisDb, userId: string, switchId: string, now?: Date) {
  const sw = await repo.getSwitch(db, userId, switchId);
  if (!sw) throw new Error('not_found');
  if (sw.status !== 'draft' && sw.status !== 'paused') {
    throw new Error(`invalid_state:${sw.status}`);
  }

  const currentNow = now ?? new Date();
  const patch: Record<string, unknown> = {};

  if (sw.mode === 'trip') {
    if (!sw.triggerAt) throw new Error('invalid_state:missing_trigger_at');
    const triggerMs = sw.triggerAt instanceof Date ? sw.triggerAt.getTime() : new Date(sw.triggerAt).getTime();
    const warningStartsAt = new Date(triggerMs - sw.warningWindowDays * 86400000);
    patch.warningStartsAt = warningStartsAt;
  } else if (sw.mode === 'heartbeat') {
    if (!sw.heartbeatIntervalDays || sw.heartbeatIntervalDays <= 0) {
      throw new Error('invalid_state:missing_heartbeat_interval');
    }
    const nextCheckInDueAt = new Date(currentNow.getTime() + sw.heartbeatIntervalDays * 86400000);
    patch.nextCheckInDueAt = nextCheckInDueAt;
  }

  const updated = await repo.markSwitchStatus(db, userId, switchId, 'armed', patch);
  if (!updated) throw new Error('not_found');

  await writeAuditEvent(db, {
    userId,
    switchId,
    eventType: 'switch_armed',
    actorType: 'user',
    actorId: userId,
    metadata: { switchId },
  });

  return updated;
}

// Pause a switch (armed|warning → paused)
// Validates: status must be 'armed' or 'warning'
// Updates status='paused'
// Writes audit: switch_paused { switchId }
export async function pauseSwitch(db: AegisDb, userId: string, switchId: string) {
  const sw = await repo.getSwitch(db, userId, switchId);
  if (!sw) throw new Error('not_found');
  if (sw.status !== 'armed' && sw.status !== 'warning') {
    throw new Error(`invalid_state:${sw.status}`);
  }

  const updated = await repo.markSwitchStatus(db, userId, switchId, 'paused');
  if (!updated) throw new Error('not_found');

  await writeAuditEvent(db, {
    userId,
    switchId,
    eventType: 'switch_paused',
    actorType: 'user',
    actorId: userId,
    metadata: { switchId },
  });

  return updated;
}

// Cancel a switch (armed|warning|paused → cancelled)
// Validates: status must be 'armed' | 'warning' | 'paused'
// Updates status='cancelled'
// Writes audit: switch_cancelled { switchId }
export async function cancelSwitch(db: AegisDb, userId: string, switchId: string) {
  const sw = await repo.getSwitch(db, userId, switchId);
  if (!sw) throw new Error('not_found');
  if (sw.status !== 'armed' && sw.status !== 'warning' && sw.status !== 'paused') {
    throw new Error(`invalid_state:${sw.status}`);
  }

  const updated = await repo.markSwitchStatus(db, userId, switchId, 'cancelled');
  if (!updated) throw new Error('not_found');

  await writeAuditEvent(db, {
    userId,
    switchId,
    eventType: 'switch_cancelled',
    actorType: 'user',
    actorId: userId,
    metadata: { switchId },
  });

  return updated;
}

// Check in (heartbeat mode, armed|warning → armed)
// Validates: mode must be 'heartbeat', status must be 'armed' or 'warning'
// Updates: status='armed', lastCheckInAt=now, nextCheckInDueAt=now+heartbeatIntervalDays*86400000
// Writes audit: switch_checked_in { switchId }
export async function checkInSwitch(
  db: AegisDb,
  userId: string,
  switchId: string,
  now?: Date,
) {
  const sw = await repo.getSwitch(db, userId, switchId);
  if (!sw) throw new Error('not_found');
  if (sw.mode !== 'heartbeat') throw new Error(`invalid_state:${sw.status}`);
  if (sw.status !== 'armed' && sw.status !== 'warning') {
    throw new Error(`invalid_state:${sw.status}`);
  }

  const currentNow = now ?? new Date();
  const nextCheckInDueAt = new Date(
    currentNow.getTime() + (sw.heartbeatIntervalDays ?? 1) * 86400000,
  );

  const updated = await repo.markSwitchStatus(db, userId, switchId, 'armed', {
    lastCheckInAt: currentNow,
    nextCheckInDueAt,
  });
  if (!updated) throw new Error('not_found');

  await writeAuditEvent(db, {
    userId,
    switchId,
    eventType: 'switch_checked_in',
    actorType: 'user',
    actorId: userId,
    metadata: { switchId },
  });

  return updated;
}

// Evaluate switch (called by worker or on-demand)
// Only evaluates 'armed' or 'warning' switches
// Trip mode:
//   if now >= warningStartsAt AND status=armed → transition to warning
//   if now >= triggerAt AND (status=armed OR status=warning) → transition to triggered, create release run
// Heartbeat mode:
//   if now > nextCheckInDueAt AND status=armed → transition to warning
//   if now > nextCheckInDueAt + gracePeriodHours*3600000 AND status=warning → transition to triggered, create release run
// On trigger: check getActiveReleaseRun — if exists, DON'T create another (release-run constraint)
// On trigger: createReleaseRun, write audit: switch_triggered { switchId, releaseRunId }
// Returns updated switch (or unchanged if no transition)
export async function evaluateSwitch(
  db: AegisDb,
  userId: string,
  switchId: string,
  now?: Date,
) {
  const sw = await repo.getSwitch(db, userId, switchId);
  if (!sw) throw new Error('not_found');
  if (sw.status !== 'armed' && sw.status !== 'warning') {
    return sw;
  }

  const currentNow = now ?? new Date();
  const nowMs = currentNow.getTime();

  if (sw.mode === 'trip') {
    const triggerAtMs = sw.triggerAt ? new Date(sw.triggerAt).getTime() : null;
    const warningStartsAtMs = sw.warningStartsAt ? new Date(sw.warningStartsAt).getTime() : null;

    // Check trigger first (highest priority)
    if (triggerAtMs !== null && nowMs >= triggerAtMs && (sw.status === 'armed' || sw.status === 'warning')) {
      return await triggerSwitch(db, userId, switchId, currentNow);
    }

    // Check warning transition
    if (warningStartsAtMs !== null && nowMs >= warningStartsAtMs && sw.status === 'armed') {
      const updated = await repo.markSwitchStatus(db, userId, switchId, 'warning', {
        lastEvaluatedAt: currentNow,
      });
      if (!updated) throw new Error('not_found');
      await writeAuditEvent(db, {
        userId,
        switchId,
        eventType: 'switch_warning',
        actorType: 'system',
        metadata: { switchId },
      });
      return updated;
    }
  } else if (sw.mode === 'heartbeat') {
    const nextDueMs = sw.nextCheckInDueAt ? new Date(sw.nextCheckInDueAt).getTime() : null;

    if (nextDueMs !== null) {
      const graceDeadlineMs = nextDueMs + (sw.gracePeriodHours ?? 72) * 3600000;

      // Check trigger: warning + past grace deadline
      if (nowMs > graceDeadlineMs && sw.status === 'warning') {
        return await triggerSwitch(db, userId, switchId, currentNow);
      }

      // Check warning transition: past due and still armed
      if (nowMs > nextDueMs && sw.status === 'armed') {
        const updated = await repo.markSwitchStatus(db, userId, switchId, 'warning', {
          lastEvaluatedAt: currentNow,
        });
        if (!updated) throw new Error('not_found');
        await writeAuditEvent(db, {
          userId,
          switchId,
          eventType: 'switch_warning',
          actorType: 'system',
          metadata: { switchId },
        });
        return updated;
      }
    }
  }

  // No transition needed; update lastEvaluatedAt
  const updated = await repo.markSwitchStatus(db, userId, switchId, sw.status as any, {
    lastEvaluatedAt: currentNow,
  });
  return updated ?? sw;
}

async function triggerSwitch(db: AegisDb, userId: string, switchId: string, now: Date) {
  const updated = await repo.markSwitchStatus(db, userId, switchId, 'triggered', {
    lastEvaluatedAt: now,
  });
  if (!updated) throw new Error('not_found');

  // Enforce release-run constraint: only one active run per user
  const existingRun = await repo.getActiveReleaseRun(db, userId);
  if (!existingRun) {
    const run = await repo.createReleaseRun(db, userId, switchId);
    await writeAuditEvent(db, {
      userId,
      switchId,
      releaseRunId: run.id,
      eventType: 'switch_triggered',
      actorType: 'system',
      metadata: { switchId, releaseRunId: run.id },
    });
  } else {
    // Switch triggered but an active run already exists; log without creating another
    await writeAuditEvent(db, {
      userId,
      switchId,
      releaseRunId: existingRun.id,
      eventType: 'switch_triggered',
      actorType: 'system',
      metadata: { switchId, releaseRunId: existingRun.id, existingRunReused: true },
    });
  }

  return updated;
}
