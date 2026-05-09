import { z } from 'zod';

export const PacketSourceAppSchema = z.enum(['aegis_core', 'aegis_hosted', 'partner']);

export const PacketEnvelopeSchema = z.object({
  version: z.literal(1),
  packetId: z.string().uuid(),
  switchId: z.string().uuid().optional(),
  userId: z.string().uuid(),
  sourceApp: PacketSourceAppSchema.default('aegis_core'),
  encryptionAlgorithm: z.literal('aes-256-gcm'),
  keyId: z.string(),
  contentHash: z.string(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.string()).optional(),
});

export type PacketSourceApp = z.infer<typeof PacketSourceAppSchema>;
export type PacketEnvelope = z.infer<typeof PacketEnvelopeSchema>;
