import { z } from 'zod';

export const StorageProviderSchema = z.enum(['s3', 'r2', 'local', 'none']);

export const StorageLocationSchema = z.object({
  provider: StorageProviderSchema,
  bucket: z.string().optional(),
  objectKey: z.string().optional(),
  region: z.string().optional(),
});

export type StorageProvider = z.infer<typeof StorageProviderSchema>;
export type StorageLocation = z.infer<typeof StorageLocationSchema>;
