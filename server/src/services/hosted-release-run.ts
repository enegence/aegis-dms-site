import type { AegisDb } from '../db/index.js';
import type { AppConfig } from '../config.js';
import {
  getActiveReleaseRunForUser,
  createReleaseRun,
  updateReleaseRun,
  appendSuppressedSwitchId,
} from '../repositories/release-run-repository.js';
import { buildHostedPacket } from './hosted-packet-builder.js';
import { writeAuditEvent } from './audit.js';

export interface StartOrAttachInput {
  db: AegisDb;
  config: AppConfig;
  userId: string;
  triggeringSwitchId: string;
  reason: 'trip_triggered' | 'heartbeat_missed' | 'manual_test';
}

export interface ReleaseRunStartResult {
  releaseRunId: string;
  packetId: string | null;
  isNew: boolean;
  suppressedSwitchIds: string[];
}

export async function startOrAttachHostedReleaseRun(
  input: StartOrAttachInput,
): Promise<ReleaseRunStartResult> {
  const { db, config, userId, triggeringSwitchId, reason } = input;

  const existingRun = await getActiveReleaseRunForUser(db, userId);

  if (existingRun) {
    await appendSuppressedSwitchId(db, existingRun.id, triggeringSwitchId);

    await writeAuditEvent(db, {
      userId,
      switchId: triggeringSwitchId,
      releaseRunId: existingRun.id,
      eventType: 'release_run_suppressed_duplicate',
      actorType: 'system',
      metadata: { releaseRunId: existingRun.id, switchId: triggeringSwitchId, reason },
    });

    const currentIds = Array.isArray(existingRun.suppressedSwitchIds)
      ? (existingRun.suppressedSwitchIds as string[])
      : [];

    return {
      releaseRunId: existingRun.id,
      packetId: existingRun.activePacketId ?? null,
      isNew: false,
      suppressedSwitchIds: [...currentIds, triggeringSwitchId],
    };
  }

  const run = await createReleaseRun(db, {
    userId,
    triggeringSwitchId,
    source: 'hosted',
    status: 'active',
  });

  let packetId: string | null = null;
  try {
    const packetResult = await buildHostedPacket({
      userId,
      switchId: triggeringSwitchId,
      releaseRunId: run.id,
      db,
      config,
    });
    packetId = packetResult.packetId;
    await updateReleaseRun(db, run.id, { activePacketId: packetId });
  } catch (err) {
    console.error('[hosted-release-run] packet build failed:', err);
  }

  await writeAuditEvent(db, {
    userId,
    switchId: triggeringSwitchId,
    releaseRunId: run.id,
    eventType: 'release_run_started',
    actorType: 'system',
    metadata: { releaseRunId: run.id, switchId: triggeringSwitchId, reason, packetId },
  });

  return {
    releaseRunId: run.id,
    packetId,
    isNew: true,
    suppressedSwitchIds: [],
  };
}
