import type { AegisDb } from '../db/index.js';
import type { AppConfig } from '../config.js';
import { evaluateSwitch } from './switch-engine.js';
import { startOrAttachHostedReleaseRun } from './hosted-release-run.js';

export async function evaluateHostedSwitch(
  db: AegisDb,
  config: AppConfig,
  userId: string,
  switchId: string,
  now?: Date,
) {
  const sw = await evaluateSwitch(db, userId, switchId, now);

  if (sw.status === 'triggered') {
    await startOrAttachHostedReleaseRun({
      db,
      config,
      userId,
      triggeringSwitchId: switchId,
      reason: 'trip_triggered',
    });
  }

  return sw;
}
