import { get, post, put, del } from './api';

export interface Contact {
  id: string;
  fullName: string;
  relationship?: string | null;
  priorityOrder: number;
  email: string;
  phone?: string | null;
  telegramHandle?: string | null;
  preferredChannels: Array<'email' | 'telegram'>;
  confirmationWindowHours: number;
  backupNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const listContacts = () =>
  get<{ contacts: Contact[] }>('/api/contacts');

export const createContact = (input: {
  fullName: string;
  email: string;
  relationship?: string;
  phone?: string;
  telegramHandle?: string;
  preferredChannels?: string[];
  confirmationWindowHours?: number;
}) => post<{ contact: Contact }>('/api/contacts', input);

export const updateContact = (id: string, input: Partial<Contact>) =>
  put<{ contact: Contact }>(`/api/contacts/${id}`, input);

export const deleteContact = (id: string) =>
  del<{ ok: boolean }>(`/api/contacts/${id}`);

export const reorderContacts = (orderedIds: string[]) =>
  post<{ ok: boolean }>('/api/contacts/reorder', { orderedIds });
