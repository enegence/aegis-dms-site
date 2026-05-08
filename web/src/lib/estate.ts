import { get, post, put, del } from './api';

export interface EstateItem {
  id: string;
  category: string;
  title: string;
  institutionName?: string | null;
  accountType?: string | null;
  referenceHint?: string | null;
  assetDescription?: string | null;
  locationNotes?: string | null;
  executorNotes?: string | null;
  sensitiveFlag: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const listEstateItems = () =>
  get<{ items: EstateItem[] }>('/api/estate-items');

export const createEstateItem = (input: Partial<EstateItem> & { category: string; title: string }) =>
  post<{ item: EstateItem }>('/api/estate-items', input);

export const updateEstateItem = (id: string, input: Partial<EstateItem>) =>
  put<{ item: EstateItem }>(`/api/estate-items/${id}`, input);

export const deleteEstateItem = (id: string) =>
  del<{ ok: boolean }>(`/api/estate-items/${id}`);
