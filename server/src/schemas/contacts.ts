import { z } from 'zod';

export const CreateContactSchema = z.object({
  fullName: z.string().min(1).max(200),
  relationship: z.string().max(200).optional(),
  email: z.string().email().max(320),
  phone: z.string().max(50).optional(),
  telegramHandle: z.string().max(100).optional(),
  preferredChannels: z.array(z.enum(['email', 'telegram'])).default(['email']),
  confirmationWindowHours: z.number().int().min(1).max(720).default(48),
  backupNotes: z.string().max(2000).optional(),
  priorityOrder: z.number().int().min(0).optional(),
});

export const UpdateContactSchema = CreateContactSchema.partial();

export const ContactParamsSchema = z.object({
  id: z.string().uuid(),
});

export const ReorderContactsSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});
