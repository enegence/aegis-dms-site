import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../../lib/api';

interface ReleaseRun {
  id: string;
  userId: string;
  source: string;
  status: string;
  triggeringSwitchId: string | null;
  relayConnectionId: string | null;
  startedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

function statusColor(status: string) {
  if (status === 'active') return 'text-brand-accent';
  if (status === 'completed') return 'text-green-600';
  if (status === 'failed') return 'text-brand-danger';
  if (status === 'cancelled') return 'text-brand-muted';
  return 'text-brand-ink';
}

export default function AdminReleaseRuns() {
  const [runs, setRuns] = useState<ReleaseRun[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    get<{ releaseRuns: ReleaseRun[] }>('/api/admin/release-runs')
      .then(d => setRuns(d.releaseRuns))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div className="p-8 text-brand-danger font-sans">{error}</div>;

  return (
    <div className="min-h-screen bg-brand-bg p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="font-hand text-4xl font-bold mb-1 text-brand-ink">Release Runs</h1>
        <p className="font-sans text-sm text-brand-muted mb-6">{runs.length} total</p>

        <nav className="flex gap-4 mb-8 text-sm font-sans">
          <Link to="/admin" className="text-brand-muted hover:text-brand-ink">Overview</Link>
          <Link to="/admin/users" className="text-brand-muted hover:text-brand-ink">Users</Link>
          <Link to="/admin/relay" className="text-brand-muted hover:text-brand-ink">Relay</Link>
          <Link to="/admin/release-runs" className="text-brand-accent font-semibold">Release Runs</Link>
        </nav>

        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans border border-brand-border rounded-lg overflow-hidden">
            <thead className="bg-brand-surface text-brand-muted">
              <tr>
                <th className="px-4 py-2 text-left">Source</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Started</th>
                <th className="px-4 py-2 text-left">Completed / Cancelled</th>
                <th className="px-4 py-2 text-left">Trigger Ref</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-brand-muted">No release runs.</td>
                </tr>
              )}
              {runs.map(r => (
                <tr key={r.id} className="border-t border-brand-border hover:bg-brand-surface/50">
                  <td className="px-4 py-2 text-brand-ink">{r.source}</td>
                  <td className={`px-4 py-2 font-semibold ${statusColor(r.status)}`}>{r.status}</td>
                  <td className="px-4 py-2 text-brand-muted">
                    {new Date(r.startedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-brand-muted">
                    {r.completedAt
                      ? new Date(r.completedAt).toLocaleString()
                      : r.cancelledAt
                      ? new Date(r.cancelledAt).toLocaleString()
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-brand-muted font-mono text-xs">
                    {r.triggeringSwitchId
                      ? `switch:${r.triggeringSwitchId.slice(0, 8)}`
                      : r.relayConnectionId
                      ? `relay:${r.relayConnectionId.slice(0, 8)}`
                      : '—'}
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
