interface AdminRelayConnection {
  id: string;
  userId: string;
  label: string | null;
  mode: string;
  status: string;
  lastHeartbeatAt: string | null;
  offlineAlertSentAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

interface RelayMetricsProps {
  connections: AdminRelayConnection[];
}

function statusColor(status: string) {
  if (status === 'active') return 'text-green-600';
  if (status === 'offline') return 'text-brand-danger';
  if (status === 'revoked') return 'text-brand-muted line-through';
  return 'text-brand-muted';
}

function statusBg(status: string) {
  if (status === 'active') return 'bg-green-100 text-green-800';
  if (status === 'offline') return 'bg-red-100 text-brand-danger';
  return 'bg-brand-surface text-brand-muted';
}

export default function RelayMetrics({ connections }: RelayMetricsProps) {
  const active = connections.filter(c => c.status === 'active').length;
  const offline = connections.filter(c => c.status === 'offline').length;
  const revoked = connections.filter(c => c.status === 'revoked').length;

  return (
    <div>
      <div className="flex gap-6 mb-4 text-sm font-sans">
        <div>
          <span className="text-brand-muted">Total: </span>
          <span className="font-semibold text-brand-ink">{connections.length}</span>
        </div>
        <div>
          <span className="text-brand-muted">Active: </span>
          <span className="font-semibold text-green-600">{active}</span>
        </div>
        {offline > 0 && (
          <div>
            <span className="text-brand-muted">Offline: </span>
            <span className="font-semibold text-brand-danger">{offline}</span>
          </div>
        )}
        {revoked > 0 && (
          <div>
            <span className="text-brand-muted">Revoked: </span>
            <span className="font-semibold text-brand-muted">{revoked}</span>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-sans border border-brand-border rounded-lg overflow-hidden">
          <thead className="bg-brand-surface text-brand-muted">
            <tr>
              <th className="px-4 py-2 text-left">Label</th>
              <th className="px-4 py-2 text-left">Mode</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Last Heartbeat</th>
              <th className="px-4 py-2 text-left">Alert Sent</th>
              <th className="px-4 py-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {connections.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-brand-muted">No relay connections.</td>
              </tr>
            )}
            {connections.map(c => (
              <tr key={c.id} className="border-t border-brand-border hover:bg-brand-surface/50">
                <td className="px-4 py-2 text-brand-ink">
                  {c.label ?? <span className="text-brand-muted italic">unlabeled</span>}
                </td>
                <td className="px-4 py-2 text-brand-muted">{c.mode}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${statusBg(c.status)}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-brand-muted">
                  {c.lastHeartbeatAt ? new Date(c.lastHeartbeatAt).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2 text-brand-muted">
                  {c.offlineAlertSentAt ? new Date(c.offlineAlertSentAt).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2 text-brand-muted">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
