import { z } from 'zod';

export const DeploymentModeSchema = z.enum([
  'vault', 'dead_drop', 'relay_monitoring', 'relay_escrow', 'hosted'
]);

export const HeartbeatSchema = z.object({
  version: z.literal(1),
  relayConnectionId: z.string().uuid(),
  timestamp: z.string().datetime(),
  mode: DeploymentModeSchema,
  switchCount: z.number().int().min(0),
  metadata: z.record(z.unknown()).optional(),
});

export type DeploymentMode = z.infer<typeof DeploymentModeSchema>;
export type Heartbeat = z.infer<typeof HeartbeatSchema>;
