import { get, post, put, del } from './api';

export interface Switch {
  id: string;
  name: string;
  mode: 'trip' | 'heartbeat';
  status: string;
  triggerAt: string | null;
  nextCheckInDueAt: string | null;
  heartbeatIntervalDays: number | null;
  gracePeriodHours: number;
  warningWindowDays: number;
  selectedContactIds: string[];
  selectedEstateItemIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ReadinessCheck {
  key: string;
  label: string;
  passed: boolean;
  level: 'required' | 'warning';
  message?: string;
}

export interface SwitchReadiness {
  ready: boolean;
  checks: ReadinessCheck[];
}

export const listSwitches = () =>
  get<{ switches: Switch[] }>('/api/switches');

export const createSwitch = (input: {
  name: string;
  mode: string;
  triggerAt?: string;
  heartbeatIntervalDays?: number;
  gracePeriodHours?: number;
  warningWindowDays?: number;
  selectedContactIds?: string[];
  selectedEstateItemIds?: string[];
}) => post<{ switch: Switch }>('/api/switches', input);

export const updateSwitch = (id: string, input: Partial<Switch>) =>
  put<{ switch: Switch }>(`/api/switches/${id}`, input);

export const deleteSwitch = (id: string) =>
  del<{ ok: boolean }>(`/api/switches/${id}`);

export const getSwitchReadiness = (id: string) =>
  get<SwitchReadiness>(`/api/switches/${id}/readiness`);

export const armSwitch = (id: string) =>
  post<{ switch: Switch }>(`/api/switches/${id}/arm`, {});

export const pauseSwitch = (id: string) =>
  post<{ switch: Switch }>(`/api/switches/${id}/pause`, {});

export const cancelSwitch = (id: string) =>
  post<{ switch: Switch }>(`/api/switches/${id}/cancel`, {});

export const checkInSwitch = (id: string) =>
  post<{ switch: Switch }>(`/api/switches/${id}/check-in`, {});
