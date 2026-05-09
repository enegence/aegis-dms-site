/**
 * Hosted contact cascade service.
 *
 * Manages the lifecycle of a release run cascade:
 *   pending → notified → opened → verified → accepted →
 *   packet_downloaded → key_viewed → acknowledged
 *
 * Security invariants:
 *  - Claim token RAW value is returned to caller for notification only — never stored.
 *  - claimTokenHash (SHA-256) is the only DB-persisted form.
 *  - Decrypted contact PII is used only for notification transport.
 */

import { and, eq, inArray, asc } from 'drizzle-orm';
import type { AegisDb } from '../db/index.js';
import type { AppConfig } from '../config.js';
import { contacts, switches } from '../db/schema.js';
import { decryptContact } from './contact-mapper.js';
import {
  generateClaimToken,
  createContactClaim,
  listClaimsForReleaseRun,
  updateContactClaim,
} from '../repositories/contact-claim-repository.js';
import { getReleaseRunById, updateReleaseRun } from '../repositories/release-run-repository.js';
import { sendContactClaimNotification, sendCascadeEscalationNotice } from './notifications.js';
import { writeAuditEvent } from './audit.js';

export interface StartCascadeInput {
  db: AegisDb;
  config: AppConfig;
  releaseRunId: string;
  baseUrl: string;
}

export interface StartCascadeResult {
  claimId: string;
  claimToken: string;
  contactId: string;
}

/**
 * Start cascade by creating a claim for the first (lowest priorityOrder) contact
 * on the triggering switch.
 */
export async function startCascadeForReleaseRun(
  input: StartCascadeInput,
): Promise<StartCascadeResult> {
  const { db, config, releaseRunId, baseUrl } = input;

  const run = await getReleaseRunById(db, releaseRunId);
  if (!run) throw new Error('release_run_not_found');
  if (!run.activePacketId) throw new Error('release_run_has_no_packet');

  // Load contacts from triggering switch ordered by priority
  const orderedContacts = await getOrderedContactsForRun(db, run);
  if (orderedContacts.length === 0) throw new Error('no_contacts_for_cascade');

  const firstContact = orderedContacts[0];
  return createClaimAndNotify({
    db,
    config,
    releaseRunId,
    packetId: run.activePacketId,
    switchId: run.triggeringSwitchId ?? null,
    contact: firstContact,
    baseUrl,
    isEscalation: false,
  });
}

/**
 * Escalate a claim: mark it escalated, move to next contact.
 * If no contacts remain, marks the release run as failed.
 */
export async function escalateClaim(input: {
  db: AegisDb;
  config: AppConfig;
  claimId: string;
  baseUrl: string;
}): Promise<{ escalated: true; nextClaimId: string } | { escalated: false; failed: true }> {
  const { db, config, claimId, baseUrl } = input;

  const {
    getContactClaimById,
  } = await import('../repositories/contact-claim-repository.js');

  const claim = await getContactClaimById(db, claimId);
  if (!claim) throw new Error('claim_not_found');
  if (!claim.releaseRunId) throw new Error('claim_has_no_release_run');

  const now = new Date();

  // Mark current claim as escalated
  await updateContactClaim(db, claimId, { status: 'escalated', escalatedAt: now });

  await writeAuditEvent(db, {
    userId: null,
    releaseRunId: claim.releaseRunId,
    eventType: 'contact_escalated',
    actorType: 'system',
    metadata: { claimId, contactId: claim.contactId },
  });

  const run = await getReleaseRunById(db, claim.releaseRunId);
  if (!run || !run.activePacketId) throw new Error('release_run_or_packet_not_found');

  // Determine next contact
  const allContacts = await getOrderedContactsForRun(db, run);
  const existingClaims = await listClaimsForReleaseRun(db, claim.releaseRunId);
  const claimedContactIds = new Set(existingClaims.map((c) => c.contactId));

  const nextContact = allContacts.find((c) => !claimedContactIds.has(c.id));

  if (!nextContact) {
    // All contacts exhausted
    await updateReleaseRun(db, claim.releaseRunId, { status: 'failed' });
    await writeAuditEvent(db, {
      userId: run.userId,
      releaseRunId: claim.releaseRunId,
      eventType: 'cascade_failed',
      actorType: 'system',
      metadata: { releaseRunId: claim.releaseRunId, reason: 'all_contacts_exhausted' },
    });
    return { escalated: false, failed: true };
  }

  const next = await createClaimAndNotify({
    db,
    config,
    releaseRunId: claim.releaseRunId,
    packetId: run.activePacketId,
    switchId: run.triggeringSwitchId ?? null,
    contact: nextContact,
    baseUrl,
    isEscalation: true,
  });

  return { escalated: true, nextClaimId: next.claimId };
}

/**
 * Acknowledge a claim, completing the cascade and release run.
 */
export async function acknowledgeClaim(
  db: AegisDb,
  claimId: string,
): Promise<void> {
  const { getContactClaimById } = await import(
    '../repositories/contact-claim-repository.js'
  );

  const claim = await getContactClaimById(db, claimId);
  if (!claim) throw new Error('claim_not_found');
  if (!['accepted', 'packet_downloaded', 'key_viewed'].includes(claim.status)) {
    throw new Error(`invalid_state_for_ack:${claim.status}`);
  }

  const now = new Date();

  await updateContactClaim(db, claimId, {
    status: 'acknowledged',
    acknowledgedAt: now,
  });

  if (claim.releaseRunId) {
    await updateReleaseRun(db, claim.releaseRunId, {
      status: 'completed',
      completedAt: now,
    });

    await writeAuditEvent(db, {
      userId: null,
      releaseRunId: claim.releaseRunId,
      eventType: 'cascade_completed',
      actorType: 'contact',
      metadata: { claimId, contactId: claim.contactId },
    });
  }

  await writeAuditEvent(db, {
    userId: null,
    releaseRunId: claim.releaseRunId ?? null,
    eventType: 'claim_acknowledged',
    actorType: 'contact',
    metadata: { claimId, contactId: claim.contactId },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getOrderedContactsForRun(
  db: AegisDb,
  run: Awaited<ReturnType<typeof getReleaseRunById>>,
) {
  if (!run) return [];

  // Get contact IDs from the triggering switch
  let contactIds: string[] = [];
  if (run.triggeringSwitchId) {
    const switchRows = await db
      .select({ selectedContactIds: switches.selectedContactIds })
      .from(switches)
      .where(eq(switches.id, run.triggeringSwitchId));

    if (switchRows.length > 0) {
      contactIds = (Array.isArray(switchRows[0].selectedContactIds)
        ? switchRows[0].selectedContactIds
        : []) as string[];
    }
  }

  if (contactIds.length === 0) return [];

  return db
    .select()
    .from(contacts)
    .where(and(inArray(contacts.id, contactIds), eq(contacts.userId, run.userId)))
    .orderBy(asc(contacts.priorityOrder));
}

interface CreateClaimAndNotifyInput {
  db: AegisDb;
  config: AppConfig;
  releaseRunId: string;
  packetId: string;
  switchId: string | null;
  contact: typeof contacts.$inferSelect;
  baseUrl: string;
  isEscalation: boolean;
}

async function createClaimAndNotify(
  input: CreateClaimAndNotifyInput,
): Promise<StartCascadeResult> {
  const { db, config, releaseRunId, packetId, switchId, contact, baseUrl, isEscalation } =
    input;

  const run = await getReleaseRunById(db, releaseRunId);
  const userId = run?.userId ?? contact.userId;

  const { raw: claimToken, hash: claimTokenHash } = generateClaimToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + contact.confirmationWindowHours * 3600_000);

  const claim = await createContactClaim(db, {
    packetId,
    contactId: contact.id,
    releaseRunId,
    switchId,
    claimTokenHash,
    expiresAt,
  });

  // Update release run's current claim pointer
  await updateReleaseRun(db, releaseRunId, { currentContactClaimId: claim.id });

  await writeAuditEvent(db, {
    userId,
    releaseRunId,
    eventType: 'contact_claim_created',
    actorType: 'system',
    metadata: { claimId: claim.id, contactId: contact.id },
  });

  // Decrypt contact PII for notification transport only — not stored
  const decrypted = decryptContact(contact, config.fieldEncryptionKey);
  const claimUrl = `${baseUrl}/claim/${claimToken}`;

  if (isEscalation) {
    await sendCascadeEscalationNotice(
      { db, config },
      {
        userId,
        contactId: contact.id,
        releaseRunId,
        contactClaimId: claim.id,
        toEmail: decrypted.email,
        toTelegramHandle: decrypted.telegramHandle ?? null,
        claimUrl,
      },
    );
  } else {
    await sendContactClaimNotification(
      { db, config },
      {
        userId,
        contactId: contact.id,
        releaseRunId,
        contactClaimId: claim.id,
        toEmail: decrypted.email,
        toTelegramHandle: decrypted.telegramHandle ?? null,
        subject: 'You have a pending Aegis claim',
        htmlBody: `<p>A claim has been made available for you. Visit <a href="${claimUrl}">${claimUrl}</a> to proceed.</p>`,
        textBody: `A claim has been made available for you. Visit ${claimUrl} to proceed.`,
        claimUrl,
      },
    );
  }

  // Update claim status to notified
  await updateContactClaim(db, claim.id, { status: 'notified', notifiedAt: now });

  await writeAuditEvent(db, {
    userId,
    releaseRunId,
    eventType: 'contact_notified',
    actorType: 'system',
    metadata: { claimId: claim.id, contactId: contact.id },
  });

  return {
    claimId: claim.id,
    claimToken,
    contactId: contact.id,
  };
}
