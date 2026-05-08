import { get, post, del } from './api';

export interface RelayConnection {
  id: string;
  label: string | null;
  status: string;
  lastHeartbeatAt: string | null;
  lastExpectedHeartbeatAt: string | null;
  mode: string;
  createdAt: string;
}

export const listRelayConnections = () =>
  get<{ connections: RelayConnection[] }>('/api/relay/connections');

export const createRelayConnection = (input: { label?: string; mode?: string }) =>
  post<{ connection: RelayConnection; apiKey: string }>('/api/relay/connections', input);

export const rotateRelayKey = (id: string) =>
  post<{ connection: RelayConnection; apiKey: string }>(`/api/relay/connections/${id}/rotate-key`, {});

export const revokeRelayConnection = (id: string) =>
  post<{ ok: boolean }>(`/api/relay/connections/${id}/revoke`, {});

export const deleteRelayConnection = (id: string) =>
  del<{ ok: boolean }>(`/api/relay/connections/${id}`);
