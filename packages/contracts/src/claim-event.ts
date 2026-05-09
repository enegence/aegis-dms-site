import { z } from 'zod';

export const ClaimEventTypeSchema = z.enum([
  'notified', 'opened', 'verified', 'accepted',
  'packet_downloaded', 'key_viewed', 'acknowledged',
  'expired', 'escalated', 'failed'
]);

export const ClaimEventSchema = z.object({
  version: z.literal(1),
  claimId: z.string().uuid(),
  contactId: z.string().uuid(),
  switchId: z.string().uuid().optional(),
  releaseRunId: z.string().uuid().optional(),
  packetId: z.string().uuid(),
  source: z.enum(['hosted', 'relay_escrow']).optional(),
  eventType: ClaimEventTypeSchema,
  occurredAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export type ClaimEventType = z.infer<typeof ClaimEventTypeSchema>;
export type ClaimEvent = z.infer<typeof ClaimEventSchema>;
