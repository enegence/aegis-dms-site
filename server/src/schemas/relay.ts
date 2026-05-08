import { z } from 'zod';

export const CreateRelayConnectionSchema = z.object({
  label: z.string().max(200).optional(),
  mode: z.enum(['relay_monitoring']).default('relay_monitoring'),
});

export const UpdateRelayConnectionSchema = z.object({
  label: z.string().max(200).optional(),
});

export const RelayConnectionParamsSchema = z.object({
  id: z.string().uuid(),
});
