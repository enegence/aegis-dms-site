/**
 * relay-escrow.ts — Relay Escrow material management.
 *
 * Relay Escrow lets SaaS execute a release for an offline self-hosted
 * connection ONLY when the user has explicitly acknowledged the policy and
 * uploaded encrypted release material. Server-side encrypted; plaintext
 * material is never stored.
 *
 * Security invariants:
 *   - enable requires a current trust_acknowledgements row (mode=relay_escrow, current version).
 *   - materialEncrypted is the only stored form; plaintext passed in is immediately encrypted.
 *   - revokedAt set on revoke; isEscrowEnabled returns false for revoked rows.
 *   - Relay Monitoring connections cannot use this to execute a release (no escrow row = false).
 */

import { createHash } from 'crypto';
import { eq, and, desc, isNull } from 'drizzle-orm';
import type { AegisDb } from '../db/index.js';
import { trustAcknowledgements, relayEscrowMaterials, relayConnections } from '../db/schema.js';
import { encryptField, decryptField } from './field-encrypt.js';

export const RELAY_ESCROW_POLICY_VERSION = '1.0';

// ── Internal helpers ──────────────────────────────────────────────────────────

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function getOwnerConnection(db: AegisDb, userId: string, relayConnectionId: string) {
  const rows = await db
    .select()
    .from(relayConnections)
    .where(and(eq(relayConnections.id, relayConnectionId), eq(relayConnections.userId, userId)));
  return rows[0] ?? null;
}

async function getCurrentAcknowledgement(db: AegisDb, userId: string) {
  const rows = await db
    .select()
    .from(trustAcknowledgements)
    .where(
      and(
        eq(trustAcknowledgements.userId, userId),
        eq(trustAcknowledgements.mode, 'relay_escrow'),
        eq(trustAcknowledgements.version, RELAY_ESCROW_POLICY_VERSION),
      ),
    )
    .orderBy(desc(trustAcknowledgements.acceptedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getActiveEscrowMaterial(db: AegisDb, userId: string, relayConnectionId: string) {
  const rows = await db
    .select()
    .from(relayEscrowMaterials)
    .where(
      and(
        eq(relayEscrowMaterials.userId, userId),
        eq(relayEscrowMaterials.relayConnectionId, relayConnectionId),
        eq(relayEscrowMaterials.enabled, true),
        isNull(relayEscrowMaterials.revokedAt),
      ),
    )
    .orderBy(desc(relayEscrowMaterials.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

// Returns the most recent material row regardless of revocation state, for status reporting.
async function getMostRecentEscrowMaterial(db: AegisDb, userId: string, relayConnectionId: string) {
  const rows = await db
    .select()
    .from(relayEscrowMaterials)
    .where(
      and(
        eq(relayEscrowMaterials.userId, userId),
        eq(relayEscrowMaterials.relayConnectionId, relayConnectionId),
      ),
    )
    .orderBy(desc(relayEscrowMaterials.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getEscrowStatus(
  db: AegisDb,
  userId: string,
  relayConnectionId: string,
): Promise<{
  connectionExists: boolean;
  acknowledged: boolean;
  acknowledgementId: string | null;
  enabled: boolean;
  revokedAt: string | null;
  policyVersion: string;
}> {
  const conn = await getOwnerConnection(db, userId, relayConnectionId);
  if (!conn) {
    return { connectionExists: false, acknowledged: false, acknowledgementId: null, enabled: false, revokedAt: null, policyVersion: RELAY_ESCROW_POLICY_VERSION };
  }

  const ack = await getCurrentAcknowledgement(db, userId);
  // Use getMostRecentEscrowMaterial so revokedAt is visible even after revocation.
  // getActiveEscrowMaterial (isNull filter) is reserved for eligibility checks.
  const material = await getMostRecentEscrowMaterial(db, userId, relayConnectionId);

  return {
    connectionExists: true,
    acknowledged: ack != null,
    acknowledgementId: ack?.id ?? null,
    enabled: material != null && material.enabled && material.revokedAt == null,
    revokedAt: material?.revokedAt?.toISOString() ?? null,
    policyVersion: RELAY_ESCROW_POLICY_VERSION,
  };
}

export async function acknowledgeEscrowPolicy(
  db: AegisDb,
  userId: string,
  relayConnectionId: string,
  ip: string | null,
  userAgent: string | null,
): Promise<{ acknowledgementId: string }> {
  const conn = await getOwnerConnection(db, userId, relayConnectionId);
  if (!conn) throw new Error('relay_connection_not_found');

  const [row] = await db
    .insert(trustAcknowledgements)
    .values({
      userId,
      mode: 'relay_escrow',
      version: RELAY_ESCROW_POLICY_VERSION,
      ipHash: ip ? hashValue(ip) : null,
      userAgentHash: userAgent ? hashValue(userAgent) : null,
    })
    .returning();

  return { acknowledgementId: row.id };
}

export async function enableEscrow(
  db: AegisDb,
  userId: string,
  relayConnectionId: string,
  materialPlaintext: string,
  materialType: string,
  fieldEncryptionKey: string,
  contactIds: string[],
  packetId: string,
): Promise<{ escrowId: string }> {
  const conn = await getOwnerConnection(db, userId, relayConnectionId);
  if (!conn) throw new Error('relay_connection_not_found');

  const ack = await getCurrentAcknowledgement(db, userId);
  if (!ack) throw new Error('acknowledgement_required');

  const materialEncrypted = encryptField(materialPlaintext, fieldEncryptionKey);

  const [row] = await db
    .insert(relayEscrowMaterials)
    .values({
      userId,
      relayConnectionId,
      enabled: true,
      materialType,
      materialEncrypted,
      policyVersion: RELAY_ESCROW_POLICY_VERSION,
      acceptedAcknowledgementId: ack.id,
      escrowContactIds: contactIds,
      escrowPacketId: packetId,
    })
    .returning();

  return { escrowId: row.id };
}

export async function revokeEscrow(
  db: AegisDb,
  userId: string,
  relayConnectionId: string,
): Promise<{ revoked: boolean }> {
  const conn = await getOwnerConnection(db, userId, relayConnectionId);
  if (!conn) throw new Error('relay_connection_not_found');

  const material = await getActiveEscrowMaterial(db, userId, relayConnectionId);
  if (!material) return { revoked: false };

  await db
    .update(relayEscrowMaterials)
    .set({ revokedAt: new Date(), enabled: false, updatedAt: new Date() })
    .where(eq(relayEscrowMaterials.id, material.id));

  return { revoked: true };
}

/**
 * Returns true only when an active, non-revoked escrow material row exists
 * with a valid acknowledgement for the given connection. Used by Task 13
 * relay-assisted cascade eligibility check.
 */
export async function isEscrowEnabled(
  db: AegisDb,
  userId: string,
  relayConnectionId: string,
): Promise<boolean> {
  const material = await getActiveEscrowMaterial(db, userId, relayConnectionId);
  return material != null;
}

/**
 * Returns decrypted material for use by the relay-assisted cascade.
 * SECURITY: caller must not log the returned plaintext.
 */
export async function getDecryptedEscrowMaterial(
  db: AegisDb,
  userId: string,
  relayConnectionId: string,
  fieldEncryptionKey: string,
): Promise<{
  materialType: string;
  materialPlaintext: string;
  escrowContactIds: string[];
  escrowPacketId: string | null;
} | null> {
  const material = await getActiveEscrowMaterial(db, userId, relayConnectionId);
  if (!material) return null;
  const materialPlaintext = decryptField(material.materialEncrypted, fieldEncryptionKey);
  return {
    materialType: material.materialType,
    materialPlaintext,
    escrowContactIds: Array.isArray(material.escrowContactIds) ? (material.escrowContactIds as string[]) : [],
    escrowPacketId: material.escrowPacketId ?? null,
  };
}
