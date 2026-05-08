import { z } from 'zod';

const SwitchSchema = z.object({
  id: z.string(),
  name: z.string(),
  mode: z.enum(['trip', 'heartbeat']),
  status: z.string(),
  nextCheckInDueAt: z.string().nullable(),
  triggerAt: z.string().nullable(),
});

export const DashboardResponseSchema = z.object({
  user: z.object({ displayName: z.string(), emailVerified: z.boolean() }),
  subscription: z.object({ plan: z.string().nullable(), status: z.string().nullable() }),
  estateItemCount: z.number(),
  contactCount: z.number(),
  activeSwitchCount: z.number(),
  warningSwitchCount: z.number(),
  triggeredSwitchCount: z.number(),
  relayConnectionCount: z.number(),
  offlineRelayConnectionCount: z.number(),
  nextSwitch: SwitchSchema.nullable(),
  nextActionAt: z.string().nullable(),
});

export const DashboardQuerySchema = z.object({});
