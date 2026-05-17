import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../../lib/api';
import UserTable from '../../components/admin/UserTable';
import SubscriptionMetrics from '../../components/admin/SubscriptionMetrics';
import RelayMetrics from '../../components/admin/RelayMetrics';
import SystemHealthPanel from '../../components/admin/SystemHealthPanel';
import { useTheme } from '../../lib/theme';
import AppShell from '../../components/layout/AppShell';
import { buildNavItems } from '../../components/layout/navModel';
import { SketchCard, SectionTitle, StatPill } from '../../components/ui';

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

type ActivePanel = 'overview' | 'users' | 'subscriptions' | 'relay' | 'release-runs' | 'health';

export default function AdminDashboard() {
  const t = useTheme();
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

  const panels: { key: ActivePanel; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'users', label: 'Users' },
    { key: 'subscriptions', label: 'Subscriptions' },
    { key: 'relay', label: 'Relay' },
    { key: 'release-runs', label: 'Release Runs' },
    { key: 'health', label: 'System Health' },
  ];

  return (
    <AppShell navItems={buildNavItems(true)} releaseTo="/release">
      <SectionTitle sub="OPERATIONS DASHBOARD">Admin</SectionTitle>

      {error && <div style={{ color: t.danger, fontFamily: "'JetBrains Mono',monospace" }}>{error}</div>}
      {!error && loading && <div style={{ color: t.muted, fontFamily: "'JetBrains Mono',monospace" }}>Loading...</div>}

      {!error && !loading && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24, alignItems: 'center' }}>
            {panels.map(item => {
              const active = activePanel === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActivePanel(item.key)}
                  style={{
                    fontFamily: "'Caveat',cursive", fontSize: 18, fontWeight: active ? 700 : 400,
                    padding: '6px 14px', cursor: 'pointer',
                    background: active ? t.ink : 'transparent', color: active ? t.bg : t.ink,
                    border: `2px solid ${active ? t.ink : t.border}`,
                    borderRadius: '3px 8px 3px 8px / 8px 3px 8px 3px',
                    transform: active ? 'rotate(-0.4deg)' : 'none', transition: 'all 0.1s',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Link to="/admin/users" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.accent, textDecoration: 'none' }}>Full Users →</Link>
              <Link to="/admin/relay" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.accent, textDecoration: 'none' }}>Full Relay →</Link>
              <Link to="/admin/release-runs" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.accent, textDecoration: 'none' }}>Full Runs →</Link>
            </span>
          </div>

          {activePanel === 'overview' && metrics && (
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
                <StatPill label="Total Users" value={metrics.totalUsers} />
                <StatPill label="Verified Users" value={metrics.verifiedUsers} />
                <StatPill label="Active Subs" value={metrics.activeSubscriptions} />
                <StatPill label="Packets Stored" value={metrics.packetsStored} />
                <StatPill label="Relay Active" value={metrics.relayConnectionsActive} />
                <StatPill label="Relay Offline" value={metrics.relayConnectionsOffline} accent={metrics.relayConnectionsOffline > 0 ? t.danger : undefined} />
                <StatPill label="Switches Armed" value={metrics.switchesArmed} />
                <StatPill label="Switches Warning" value={metrics.switchesWarning} accent={metrics.switchesWarning > 0 ? t.danger : undefined} />
                <StatPill label="Switches Triggered" value={metrics.switchesTriggered} accent={metrics.switchesTriggered > 0 ? t.danger : undefined} />
                <StatPill label="Active Runs" value={metrics.activeReleaseRuns} accent={metrics.activeReleaseRuns > 0 ? t.danger : undefined} />
                <StatPill label="Notif Fails 24h" value={metrics.notificationFailuresLast24h} accent={metrics.notificationFailuresLast24h > 0 ? t.danger : undefined} />
              </div>
              {health && (
                <SketchCard style={{ maxWidth: 360 }}>
                  <div style={{ fontFamily: "'Caveat',cursive", fontSize: 20, fontWeight: 700, color: t.ink, marginBottom: 8 }}>System Health</div>
                  <SystemHealthPanel health={health} />
                </SketchCard>
              )}
            </div>
          )}

          {activePanel === 'users' && (
            <SketchCard>
              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 20, fontWeight: 700, color: t.ink, marginBottom: 10 }}>Users ({users.length})</div>
              <UserTable users={users} />
            </SketchCard>
          )}

          {activePanel === 'subscriptions' && (
            <SketchCard>
              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 20, fontWeight: 700, color: t.ink, marginBottom: 10 }}>Subscriptions ({subscriptions.length})</div>
              <SubscriptionMetrics subscriptions={subscriptions} />
            </SketchCard>
          )}

          {activePanel === 'relay' && (
            <SketchCard>
              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 20, fontWeight: 700, color: t.ink, marginBottom: 10 }}>Relay Connections ({relay.length})</div>
              <RelayMetrics connections={relay} />
            </SketchCard>
          )}

          {activePanel === 'release-runs' && (
            <SketchCard>
              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 20, fontWeight: 700, color: t.ink, marginBottom: 10 }}>Hosted Release Runs ({releaseRuns.length})</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: t.muted, textAlign: 'left' }}>
                      <th style={{ padding: '6px 10px' }}>Source</th>
                      <th style={{ padding: '6px 10px' }}>Status</th>
                      <th style={{ padding: '6px 10px' }}>Started</th>
                      <th style={{ padding: '6px 10px' }}>Completed</th>
                      <th style={{ padding: '6px 10px' }}>Cancelled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {releaseRuns.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: t.muted }}>No release runs.</td></tr>
                    )}
                    {releaseRuns.map(r => (
                      <tr key={r.id} style={{ borderTop: `1px dashed ${t.border}` }}>
                        <td style={{ padding: '6px 10px', color: t.muted }}>{r.source}</td>
                        <td style={{ padding: '6px 10px', color: r.status === 'completed' ? '#27AE60' : r.status === 'active' ? t.accent : r.status === 'cancelled' ? t.muted : '#C77700' }}>{r.status}</td>
                        <td style={{ padding: '6px 10px', color: t.muted }}>{new Date(r.startedAt).toLocaleString()}</td>
                        <td style={{ padding: '6px 10px', color: t.muted }}>{r.completedAt ? new Date(r.completedAt).toLocaleString() : '—'}</td>
                        <td style={{ padding: '6px 10px', color: t.muted }}>{r.cancelledAt ? new Date(r.cancelledAt).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SketchCard>
          )}

          {activePanel === 'health' && health && (
            <SketchCard style={{ maxWidth: 420 }}>
              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 20, fontWeight: 700, color: t.ink, marginBottom: 10 }}>System Health</div>
              <SystemHealthPanel health={health} />
            </SketchCard>
          )}
        </>
      )}
    </AppShell>
  );
}
