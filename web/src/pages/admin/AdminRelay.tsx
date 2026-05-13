import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../../lib/api';

interface AdminConnection {
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

function statusColor(status: string) {
  if (status === 'active') return 'text-green-600';
  if (status === 'offline') return 'text-brand-danger';
  return 'text-brand-muted';
}

export default function AdminRelay() {
  const [connections, setConnections] = useState<AdminConnection[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    get<{ connections: AdminConnection[] }>('/api/admin/relay-connections')
      .then(d => setConnections(d.connections))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div className="p-8 text-brand-danger font-sans">{error}</div>;

  return (
    <div className="min-h-screen bg-brand-bg p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="font-hand text-4xl font-bold mb-1 text-brand-ink">Relay Connections</h1>
        <p className="font-sans text-sm text-brand-muted mb-6">{connections.length} total</p>

        <nav className="flex gap-4 mb-8 text-sm font-sans">
          <Link to="/admin" className="text-brand-muted hover:text-brand-ink">Overview</Link>
          <Link to="/admin/users" className="text-brand-muted hover:text-brand-ink">Users</Link>
          <Link to="/admin/relay" className="text-brand-accent font-semibold">Relay</Link>
          <Link to="/admin/release-runs" className="text-brand-muted hover:text-brand-ink">Release Runs</Link>
        </nav>

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
                  <td className="px-4 py-2 text-brand-ink">{c.label ?? <span className="text-brand-muted italic">unlabeled</span>}</td>
                  <td className="px-4 py-2 text-brand-muted">{c.mode}</td>
                  <td className={`px-4 py-2 font-semibold ${statusColor(c.status)}`}>{c.status}</td>
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
    </div>
  );
}
