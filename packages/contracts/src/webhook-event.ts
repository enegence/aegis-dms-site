import { z } from 'zod';

export const WebhookEventTypeSchema = z.enum([
  'switch.triggered',
  'release.started',
  'release.completed',
  'release.failed',
  'claim.opened',
  'claim.verified',
  'claim.acknowledged',
  'heartbeat.missed',
  'relay.offline',
]);

export const WebhookEventSchema = z.object({
  version: z.literal(1),
  id: z.string().uuid(),
  type: WebhookEventTypeSchema,
  userId: z.string().uuid(),
  occurredAt: z.string().datetime(),
  payload: z.record(z.unknown()),
});

export type WebhookEventType = z.infer<typeof WebhookEventTypeSchema>;
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
