import { z } from 'zod';
// Dashboard has no request body schemas; response types live in packages/shared
// This file exists for any future dashboard query params
export const DashboardQuerySchema = z.object({});
