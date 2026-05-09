import { z } from 'zod';

export const ReleaseRunStatusSchema = z.enum([
  'active', 'cascade_active', 'completed', 'cancelled', 'failed'
]);

export const ReleaseRunSchema = z.object({
  version: z.literal(1),
  id: z.string().uuid(),
  userId: z.string().uuid(),
  triggeringSwitchId: z.string().uuid().optional(),
  relayConnectionId: z.string().uuid().optional(),
  source: z.enum(['hosted', 'relay_escrow']).default('hosted'),
  status: ReleaseRunStatusSchema,
  activePacketId: z.string().uuid().nullable(),
  currentContactClaimId: z.string().uuid().nullable(),
  suppressedSwitchIds: z.array(z.string().uuid()),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
});

export type ReleaseRunStatus = z.infer<typeof ReleaseRunStatusSchema>;
export type ReleaseRun = z.infer<typeof ReleaseRunSchema>;
