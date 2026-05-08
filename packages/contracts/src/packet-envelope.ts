import { z } from 'zod';

export const PacketEnvelopeSchema = z.object({
  version: z.literal(1),
  packetId: z.string().uuid(),
  switchId: z.string().uuid(),
  userId: z.string().uuid(),
  encryptionAlgorithm: z.literal('aes-256-gcm'),
  keyId: z.string(),
  contentHash: z.string(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.string()).optional(),
});

export type PacketEnvelope = z.infer<typeof PacketEnvelopeSchema>;
