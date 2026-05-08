import type { AegisDb } from '../db/index.js';
import { users, subscriptions, trustAcknowledgements } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export interface ReadinessCheck {
  key: string;
  label: string;
  passed: boolean;
  level: 'required' | 'warning';
  message?: string;
}

export interface SwitchReadiness {
  ready: boolean;
  checks: ReadinessCheck[];
}

export async function checkSwitchReadiness(
  db: AegisDb,
  userId: string,
  switchRow: {
    mode: string;
    triggerAt: Date | null;
    heartbeatIntervalDays: number | null;
    selectedContactIds: unknown;
    selectedEstateItemIds: unknown;
  },
): Promise<SwitchReadiness> {
  const checks: ReadinessCheck[] = [];

  // 1. email_verified (required)
  const userRows = await db.select().from(users).where(eq(users.id, userId));
  const user = userRows[0];
  checks.push({
    key: 'email_verified',
    label: 'Email verified',
    passed: user?.emailVerified === true,
    level: 'required',
    message: user?.emailVerified ? undefined : 'Please verify your email address.',
  });

  // 2. subscription (required, but alpha mode passes)
  const subRows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));
  const sub = subRows[0];
  const hasActiveSub =
    sub !== undefined && (sub.status === 'active' || sub.status === 'trialing');

  if (hasActiveSub) {
    checks.push({
      key: 'subscription',
      label: 'Active subscription',
      passed: true,
      level: 'required',
    });
  } else {
    // Alpha mode: no subscription required — still pass with note
    checks.push({
      key: 'subscription',
      label: 'Active subscription',
      passed: true,
      level: 'required',
      message: 'Alpha: subscription not required',
    });
  }

  // 3. has_contacts (required)
  const selectedContactIds = Array.isArray(switchRow.selectedContactIds)
    ? switchRow.selectedContactIds
    : [];
  checks.push({
    key: 'has_contacts',
    label: 'Contacts selected',
    passed: selectedContactIds.length > 0,
    level: 'required',
    message: selectedContactIds.length > 0 ? undefined : 'Select at least one contact.',
  });

  // 4. has_estate_items (required)
  const selectedEstateItemIds = Array.isArray(switchRow.selectedEstateItemIds)
    ? switchRow.selectedEstateItemIds
    : [];
  checks.push({
    key: 'has_estate_items',
    label: 'Estate items selected',
    passed: selectedEstateItemIds.length > 0,
    level: 'required',
    message: selectedEstateItemIds.length > 0 ? undefined : 'Select at least one estate item.',
  });

  // 5. valid_schedule (required)
  let scheduleOk = false;
  let scheduleMsg: string | undefined;
  if (switchRow.mode === 'trip') {
    if (switchRow.triggerAt !== null && switchRow.triggerAt !== undefined) {
      const triggerMs = switchRow.triggerAt instanceof Date
        ? switchRow.triggerAt.getTime()
        : new Date(switchRow.triggerAt as string).getTime();
      scheduleOk = triggerMs > Date.now();
      if (!scheduleOk) scheduleMsg = 'Trigger date must be in the future.';
    } else {
      scheduleMsg = 'Set a trigger date for trip mode.';
    }
  } else if (switchRow.mode === 'heartbeat') {
    scheduleOk =
      switchRow.heartbeatIntervalDays !== null &&
      switchRow.heartbeatIntervalDays !== undefined &&
      switchRow.heartbeatIntervalDays > 0;
    if (!scheduleOk) scheduleMsg = 'Set a heartbeat interval greater than 0.';
  }
  checks.push({
    key: 'valid_schedule',
    label: 'Valid schedule',
    passed: scheduleOk,
    level: 'required',
    message: scheduleMsg,
  });

  // 6. trust_acknowledgement (warning, not required)
  const trustRows = await db
    .select()
    .from(trustAcknowledgements)
    .where(
      and(eq(trustAcknowledgements.userId, userId), eq(trustAcknowledgements.mode, 'hosted')),
    );
  checks.push({
    key: 'trust_acknowledgement',
    label: 'Trust acknowledgement',
    passed: trustRows.length > 0,
    level: 'warning',
    message:
      trustRows.length > 0
        ? undefined
        : 'Please review and accept the hosted service trust acknowledgement.',
  });

  // 7. packet_storage (warning, not required) — always passes in Phase 1/2
  checks.push({
    key: 'packet_storage',
    label: 'Packet storage',
    passed: true,
    level: 'warning',
    message: 'Packet storage configured in Phase 3',
  });

  const ready = checks
    .filter((c) => c.level === 'required')
    .every((c) => c.passed);

  return { ready, checks };
}
