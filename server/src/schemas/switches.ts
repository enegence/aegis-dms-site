import { z } from 'zod';

export const CreateSwitchSchema = z.object({
  name: z.string().min(1).max(200),
  mode: z.enum(['trip', 'heartbeat']),
  triggerAt: z.string().datetime().optional(),
  heartbeatIntervalDays: z.number().int().min(1).max(365).optional(),
  gracePeriodHours: z.number().int().min(1).max(720).default(72),
  warningWindowDays: z.number().int().min(0).max(90).default(3),
  selectedContactIds: z.array(z.string().uuid()).default([]),
  selectedEstateItemIds: z.array(z.string().uuid()).default([]),
}).refine(
  (d) => d.mode !== 'trip' || d.triggerAt !== undefined,
  { message: 'triggerAt required for trip mode', path: ['triggerAt'] }
).refine(
  (d) => d.mode !== 'heartbeat' || d.heartbeatIntervalDays !== undefined,
  { message: 'heartbeatIntervalDays required for heartbeat mode', path: ['heartbeatIntervalDays'] }
);

export const UpdateSwitchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  triggerAt: z.string().datetime().optional(),
  heartbeatIntervalDays: z.number().int().min(1).max(365).optional(),
  gracePeriodHours: z.number().int().min(1).max(720).optional(),
  warningWindowDays: z.number().int().min(0).max(90).optional(),
  selectedContactIds: z.array(z.string().uuid()).optional(),
  selectedEstateItemIds: z.array(z.string().uuid()).optional(),
});

export const SwitchParamsSchema = z.object({
  id: z.string().uuid(),
});
