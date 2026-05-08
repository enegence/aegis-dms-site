import { z } from 'zod';

export const NotificationChannelSchema = z.enum(['email', 'sms', 'telegram']);

export const NotificationResultSchema = z.object({
  channel: NotificationChannelSchema,
  recipientId: z.string().uuid(),
  sentAt: z.string().datetime(),
  success: z.boolean(),
  error: z.string().optional(),
});

export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;
export type NotificationResult = z.infer<typeof NotificationResultSchema>;
