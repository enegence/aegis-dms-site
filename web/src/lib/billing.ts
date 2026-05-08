import { post } from './api';

export const openBillingPortal = (returnUrl: string) =>
  post<{ url: string }>('/api/billing/portal', { returnUrl });
