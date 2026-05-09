/**
 * packet-repository.ts — Drizzle ORM repository for the packets table.
 *
 * Covers both hosted and relay-escrow packet records.
 */

import { eq, and } from 'drizzle-orm';
import type { AegisDb } from '../db/index.js';
import { packets } from '../db/schema.js';

export type PacketRow = typeof packets.$inferSelect;

// ── createPacket ──────────────────────────────────────────────────────────────

export interface CreatePacketData {
  userId: string;
  switchId?: string | null;
  relayConnectionId?: string | null;
  // Note: packets table does not have a releaseRunId column; the FK lives on contact_claims.
  sourceApp: string;
  schemaVersion: string;
  version: number;
  encryptionAlgorithm: string;
  keyId: string;
  contentHash: string;
  encryptedObjectHash: string | null;
  storageProvider: string | null;
  storageBucket: string | null;
  storageObjectKey: string | null;
  storageRegion: string | null;
  storageVersionId: string | null;
  lastVerifiedAt: Date | null;
  expiresAt: Date | null;
}

export async function createPacket(
  db: AegisDb,
  data: CreatePacketData,
): Promise<PacketRow> {
  const rows = await db
    .insert(packets)
    .values({
      userId: data.userId,
      switchId: data.switchId ?? null,
      relayConnectionId: data.relayConnectionId ?? null,
      sourceApp: data.sourceApp,
      schemaVersion: data.schemaVersion,
      version: data.version,
      encryptionAlgorithm: data.encryptionAlgorithm,
      keyId: data.keyId,
      contentHash: data.contentHash,
      encryptedObjectHash: data.encryptedObjectHash,
      storageProvider: data.storageProvider,
      storageBucket: data.storageBucket,
      storageObjectKey: data.storageObjectKey,
      storageRegion: data.storageRegion,
      storageVersionId: data.storageVersionId,
      lastVerifiedAt: data.lastVerifiedAt,
      expiresAt: data.expiresAt,
    })
    .returning();

  return rows[0];
}

// ── getPacketById ─────────────────────────────────────────────────────────────

export async function getPacketById(
  db: AegisDb,
  packetId: string,
  userId: string,
): Promise<PacketRow | null> {
  const rows = await db
    .select()
    .from(packets)
    .where(and(eq(packets.id, packetId), eq(packets.userId, userId)));

  return rows[0] ?? null;
}

// ── listPackets ───────────────────────────────────────────────────────────────

export async function listPackets(
  db: AegisDb,
  userId: string,
): Promise<PacketRow[]> {
  return db
    .select()
    .from(packets)
    .where(eq(packets.userId, userId));
}

// ── updatePacketStorage ───────────────────────────────────────────────────────

export interface UpdatePacketStorageData {
  storageProvider?: string;
  storageBucket?: string;
  storageObjectKey?: string;
  storageRegion?: string;
  storageVersionId?: string | null;
  lastVerifiedAt?: Date;
  deletionStatus?: string;
}

export async function updatePacketStorage(
  db: AegisDb,
  packetId: string,
  data: UpdatePacketStorageData,
): Promise<void> {
  const updates: Partial<typeof packets.$inferInsert> = {};

  if (data.storageProvider !== undefined) updates.storageProvider = data.storageProvider;
  if (data.storageBucket !== undefined) updates.storageBucket = data.storageBucket;
  if (data.storageObjectKey !== undefined) updates.storageObjectKey = data.storageObjectKey;
  if (data.storageRegion !== undefined) updates.storageRegion = data.storageRegion;
  if (data.storageVersionId !== undefined) updates.storageVersionId = data.storageVersionId;
  if (data.lastVerifiedAt !== undefined) updates.lastVerifiedAt = data.lastVerifiedAt;
  if (data.deletionStatus !== undefined) updates.deletionStatus = data.deletionStatus;

  if (Object.keys(updates).length === 0) return;

  await db.update(packets).set(updates).where(eq(packets.id, packetId));
}
