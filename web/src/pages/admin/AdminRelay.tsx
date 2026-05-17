import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../../lib/api';
import { useTheme, type Theme } from '../../lib/theme';
import AppShell from '../../components/layout/AppShell';
import { buildNavItems } from '../../components/layout/navModel';
import { SketchCard, SectionTitle } from '../../components/ui';

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

function statusColor(status: string, t: Theme) {
  if (status === 'active') return '#27AE60';
  if (status === 'offline') return t.danger;
  return t.muted;
}

export default function AdminRelay() {
  const t = useTheme();
  const [connections, setConnections] = useState<AdminConnection[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    get<{ connections: AdminConnection[] }>('/api/admin/relay-connections')
      .then(d => setConnections(d.connections))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <AppShell navItems={buildNavItems(true)} releaseTo="/release">
      {error ? (
        <div role="alert" style={{ color: t.danger, fontFamily: "'JetBrains Mono',monospace" }}>{error}</div>
      ) : (
        <>
          <SectionTitle sub={`ADMIN · ${connections.length} TOTAL`}>Relay Connections</SectionTitle>
          <nav style={{ display: 'flex', gap: 16, marginBottom: 20, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
            <Link to="/admin" style={{ color: t.muted, textDecoration: 'none' }}>Overview</Link>
            <Link to="/admin/users" style={{ color: t.muted, textDecoration: 'none' }}>Users</Link>
            <Link to="/admin/relay" style={{ color: t.accent, fontWeight: 700, textDecoration: 'none' }}>Relay</Link>
            <Link to="/admin/release-runs" style={{ color: t.muted, textDecoration: 'none' }}>Release Runs</Link>
          </nav>
          <SketchCard>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: t.muted, textAlign: 'left' }}>
                    <th style={{ padding: '6px 10px' }}>Label</th>
                    <th style={{ padding: '6px 10px' }}>Mode</th>
                    <th style={{ padding: '6px 10px' }}>Status</th>
                    <th style={{ padding: '6px 10px' }}>Last Heartbeat</th>
                    <th style={{ padding: '6px 10px' }}>Alert Sent</th>
                    <th style={{ padding: '6px 10px' }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {connections.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: t.muted }}>No relay connections.</td></tr>
                  )}
                  {connections.map(c => (
                    <tr key={c.id} style={{ borderTop: `1px dashed ${t.border}` }}>
                      <td style={{ padding: '6px 10px', color: t.ink }}>{c.label ?? <span style={{ color: t.muted, fontStyle: 'italic' }}>unlabeled</span>}</td>
                      <td style={{ padding: '6px 10px', color: t.muted }}>{c.mode}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: statusColor(c.status, t) }}>{c.status}</td>
                      <td style={{ padding: '6px 10px', color: t.muted }}>{c.lastHeartbeatAt ? new Date(c.lastHeartbeatAt).toLocaleString() : '—'}</td>
                      <td style={{ padding: '6px 10px', color: t.muted }}>{c.offlineAlertSentAt ? new Date(c.offlineAlertSentAt).toLocaleString() : '—'}</td>
                      <td style={{ padding: '6px 10px', color: t.muted }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SketchCard>
        </>
      )}
    </AppShell>
  );
}
