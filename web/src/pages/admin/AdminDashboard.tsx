import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../../lib/api';

interface AdminMetrics {
  totalUsers: number;
  verifiedUsers: number;
  activeSubscriptions: number;
  relayConnectionsActive: number;
  relayConnectionsOffline: number;
  switchesArmed: number;
  switchesWarning: number;
  switchesTriggered: number;
  activeReleaseRuns: number;
  packetsStored: number;
  notificationFailuresLast24h: number;
}

function MetricCard({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="p-4 bg-brand-surface border border-brand-border rounded-lg">
      <div className={`text-2xl font-bold font-sans ${warn && value > 0 ? 'text-brand-danger' : 'text-brand-ink'}`}>
        {value}
      </div>
      <div className="text-xs font-sans text-brand-muted mt-1">{label}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    get<AdminMetrics>('/api/admin/metrics')
      .then(setMetrics)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div className="p-8 text-brand-danger font-sans">{error}</div>;
  if (!metrics) return <div className="p-8 text-brand-muted font-sans">Loading...</div>;

  return (
    <div className="min-h-screen bg-brand-bg p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-hand text-4xl font-bold mb-1 text-brand-ink">Admin</h1>
        <p className="font-sans text-sm text-brand-muted mb-6">System overview</p>

        <nav className="flex gap-4 mb-8 text-sm font-sans">
          <Link to="/admin" className="text-brand-accent font-semibold">Overview</Link>
          <Link to="/admin/users" className="text-brand-muted hover:text-brand-ink">Users</Link>
          <Link to="/admin/relay" className="text-brand-muted hover:text-brand-ink">Relay</Link>
          <Link to="/admin/release-runs" className="text-brand-muted hover:text-brand-ink">Release Runs</Link>
        </nav>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <MetricCard label="Total Users" value={metrics.totalUsers} />
          <MetricCard label="Verified Users" value={metrics.verifiedUsers} />
          <MetricCard label="Active Subscriptions" value={metrics.activeSubscriptions} />
          <MetricCard label="Packets Stored" value={metrics.packetsStored} />
          <MetricCard label="Relay Active" value={metrics.relayConnectionsActive} />
          <MetricCard label="Relay Offline" value={metrics.relayConnectionsOffline} warn />
          <MetricCard label="Switches Armed" value={metrics.switchesArmed} />
          <MetricCard label="Switches Warning" value={metrics.switchesWarning} warn />
          <MetricCard label="Switches Triggered" value={metrics.switchesTriggered} warn />
          <MetricCard label="Active Release Runs" value={metrics.activeReleaseRuns} warn />
          <MetricCard label="Notification Failures (24h)" value={metrics.notificationFailuresLast24h} warn />
        </div>

        <div className="flex gap-4">
          <Link
            to="/admin/users"
            className="px-4 py-2 bg-brand-accent text-white rounded font-sans text-sm hover:opacity-90"
          >
            Manage Users
          </Link>
          <Link
            to="/admin/relay"
            className="px-4 py-2 border border-brand-border rounded font-sans text-sm hover:bg-brand-surface"
          >
            Relay Connections
          </Link>
          <Link
            to="/admin/release-runs"
            className="px-4 py-2 border border-brand-border rounded font-sans text-sm hover:bg-brand-surface"
          >
            Release Runs
          </Link>
        </div>
      </div>
    </div>
  );
}
