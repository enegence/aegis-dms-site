import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../../lib/api';
import UserTable from '../../components/admin/UserTable';
import SubscriptionMetrics from '../../components/admin/SubscriptionMetrics';
import RelayMetrics from '../../components/admin/RelayMetrics';
import SystemHealthPanel from '../../components/admin/SystemHealthPanel';

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

interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  role: string;
  timezone: string;
  totpEnabled: boolean;
  createdAt: string;
}

interface AdminSubscription {
  id: string;
  userId: string;
  email: string;
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

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

interface AdminReleaseRun {
  id: string;
  userId: string;
  source: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

interface SystemHealth {
  status: 'ok' | 'degraded';
  dbConnected: boolean;
  uptime: number;
  timestamp: string;
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

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <h2 className="font-sans font-semibold text-brand-ink text-base">{title}</h2>
      {count !== undefined && (
        <span className="text-xs text-brand-muted font-sans">({count})</span>
      )}
    </div>
  );
}

type ActivePanel = 'overview' | 'users' | 'subscriptions' | 'relay' | 'release-runs' | 'health';

export default function AdminDashboard() {
  const [activePanel, setActivePanel] = useState<ActivePanel>('overview');
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
  const [relay, setRelay] = useState<AdminRelayConnection[]>([]);
  const [releaseRuns, setReleaseRuns] = useState<AdminReleaseRun[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      get<AdminMetrics>('/api/admin/metrics'),
      get<{ users: AdminUser[] }>('/api/admin/users'),
      get<{ subscriptions: AdminSubscription[] }>('/api/admin/subscriptions'),
      get<{ connections: AdminRelayConnection[] }>('/api/admin/relay-connections'),
      get<{ releaseRuns: AdminReleaseRun[] }>('/api/admin/release-runs'),
      get<SystemHealth>('/api/admin/system-health'),
    ])
      .then(([m, u, s, r, rr, h]) => {
        setMetrics(m);
        setUsers(u.users);
        setSubscriptions(s.subscriptions);
        setRelay(r.connections);
        setReleaseRuns(rr.releaseRuns);
        setHealth(h);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <div className="p-8 text-brand-danger font-sans">{error}</div>;
  if (loading) return <div className="p-8 text-brand-muted font-sans">Loading...</div>;

  const navItems: { key: ActivePanel; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'users', label: 'Users' },
    { key: 'subscriptions', label: 'Subscriptions' },
    { key: 'relay', label: 'Relay' },
    { key: 'release-runs', label: 'Release Runs' },
    { key: 'health', label: 'System Health' },
  ];

  return (
    <div className="min-h-screen bg-brand-bg p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="font-hand text-4xl font-bold mb-1 text-brand-ink">Admin</h1>
        <p className="font-sans text-sm text-brand-muted mb-6">Operations dashboard</p>

        {/* Top nav — in-page panels + links to dedicated pages */}
        <div className="flex flex-wrap gap-2 mb-8 text-sm font-sans border-b border-brand-border pb-3">
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => setActivePanel(item.key)}
              className={`px-3 py-1.5 rounded transition-colors ${
                activePanel === item.key
                  ? 'bg-brand-accent text-white'
                  : 'text-brand-muted hover:text-brand-ink hover:bg-brand-surface'
              }`}
            >
              {item.label}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <Link
              to="/admin/users"
              className="px-3 py-1.5 border border-brand-border rounded text-brand-muted hover:text-brand-ink hover:bg-brand-surface"
            >
              Full Users Page
            </Link>
            <Link
              to="/admin/relay"
              className="px-3 py-1.5 border border-brand-border rounded text-brand-muted hover:text-brand-ink hover:bg-brand-surface"
            >
              Full Relay Page
            </Link>
            <Link
              to="/admin/release-runs"
              className="px-3 py-1.5 border border-brand-border rounded text-brand-muted hover:text-brand-ink hover:bg-brand-surface"
            >
              Full Runs Page
            </Link>
          </div>
        </div>

        {/* Overview panel */}
        {activePanel === 'overview' && metrics && (
          <div>
            <SectionHeader title="System Metrics" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
            {health && (
              <div className="max-w-sm">
                <SectionHeader title="System Health" />
                <SystemHealthPanel health={health} />
              </div>
            )}
          </div>
        )}

        {/* Users panel */}
        {activePanel === 'users' && (
          <div>
            <SectionHeader title="Users" count={users.length} />
            <UserTable users={users} />
          </div>
        )}

        {/* Subscriptions panel */}
        {activePanel === 'subscriptions' && (
          <div>
            <SectionHeader title="Subscriptions" count={subscriptions.length} />
            <SubscriptionMetrics subscriptions={subscriptions} />
          </div>
        )}

        {/* Relay panel */}
        {activePanel === 'relay' && (
          <div>
            <SectionHeader title="Relay Connections" count={relay.length} />
            <RelayMetrics connections={relay} />
          </div>
        )}

        {/* Release Runs panel */}
        {activePanel === 'release-runs' && (
          <div>
            <SectionHeader title="Hosted Release Runs" count={releaseRuns.length} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-sans border border-brand-border rounded-lg overflow-hidden">
                <thead className="bg-brand-surface text-brand-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Source</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Started</th>
                    <th className="px-4 py-2 text-left">Completed</th>
                    <th className="px-4 py-2 text-left">Cancelled</th>
                  </tr>
                </thead>
                <tbody>
                  {releaseRuns.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-brand-muted">No release runs.</td>
                    </tr>
                  )}
                  {releaseRuns.map(r => (
                    <tr key={r.id} className="border-t border-brand-border hover:bg-brand-surface/50">
                      <td className="px-4 py-2 text-brand-muted">{r.source}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          r.status === 'completed' ? 'bg-green-100 text-green-800'
                          : r.status === 'active' ? 'bg-blue-100 text-blue-800'
                          : r.status === 'cancelled' ? 'bg-brand-surface text-brand-muted'
                          : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-brand-muted">
                        {new Date(r.startedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-brand-muted">
                        {r.completedAt ? new Date(r.completedAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2 text-brand-muted">
                        {r.cancelledAt ? new Date(r.cancelledAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* System health panel */}
        {activePanel === 'health' && health && (
          <div>
            <SectionHeader title="System Health" />
            <div className="max-w-md">
              <SystemHealthPanel health={health} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
