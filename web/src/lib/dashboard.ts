import { get } from './api';

export interface DashboardSummary {
  user: { displayName: string; emailVerified: boolean };
  subscription: { plan: string | null; status: string | null };
  estateItemCount: number;
  contactCount: number;
  activeSwitchCount: number;
  warningSwitchCount: number;
  triggeredSwitchCount: number;
  relayConnectionCount: number;
  offlineRelayConnectionCount: number;
  nextSwitch: {
    id: string;
    name: string;
    mode: string;
    status: string;
    nextCheckInDueAt: string | null;
    triggerAt: string | null;
  } | null;
  nextActionAt: string | null;
}

export const getDashboard = () => get<DashboardSummary>('/api/dashboard');
