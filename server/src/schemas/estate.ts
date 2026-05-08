import { z } from 'zod';

export const CreateEstateItemSchema = z.object({
  category: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  institutionName: z.string().max(500).optional(),
  accountType: z.string().max(200).optional(),
  referenceHint: z.string().max(500).optional(),
  assetDescription: z.string().max(2000).optional(),
  locationNotes: z.string().max(2000).optional(),
  executorNotes: z.string().max(5000).optional(),
  sensitiveFlag: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
});

export const UpdateEstateItemSchema = CreateEstateItemSchema.partial();

export const EstateItemParamsSchema = z.object({
  id: z.string().uuid(),
});
