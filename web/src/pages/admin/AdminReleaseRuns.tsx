import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../../lib/api';
import { useTheme, type Theme } from '../../lib/theme';
import AppShell from '../../components/layout/AppShell';
import { buildNavItems } from '../../components/layout/navModel';
import { SketchCard, SectionTitle } from '../../components/ui';

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

function statusColor(status: string, t: Theme) {
  if (status === 'active') return t.accent;
  if (status === 'completed') return '#27AE60';
  if (status === 'failed') return t.danger;
  if (status === 'cancelled') return t.muted;
  return t.ink;
}

export default function AdminReleaseRuns() {
  const t = useTheme();
  const [runs, setRuns] = useState<ReleaseRun[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    get<{ releaseRuns: ReleaseRun[] }>('/api/admin/release-runs')
      .then(d => setRuns(d.releaseRuns))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <AppShell navItems={buildNavItems(true)} releaseTo="/release">
      {error ? (
        <div role="alert" style={{ color: t.danger, fontFamily: "'JetBrains Mono',monospace" }}>{error}</div>
      ) : (
        <>
          <SectionTitle sub={`ADMIN · ${runs.length} TOTAL`}>Release Runs</SectionTitle>
          <nav style={{ display: 'flex', gap: 16, marginBottom: 20, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
            <Link to="/admin" style={{ color: t.muted, textDecoration: 'none' }}>Overview</Link>
            <Link to="/admin/users" style={{ color: t.muted, textDecoration: 'none' }}>Users</Link>
            <Link to="/admin/relay" style={{ color: t.muted, textDecoration: 'none' }}>Relay</Link>
            <Link to="/admin/release-runs" style={{ color: t.accent, fontWeight: 700, textDecoration: 'none' }}>Release Runs</Link>
          </nav>
          <SketchCard>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: t.muted, textAlign: 'left' }}>
                    <th style={{ padding: '6px 10px' }}>Source</th>
                    <th style={{ padding: '6px 10px' }}>Status</th>
                    <th style={{ padding: '6px 10px' }}>Started</th>
                    <th style={{ padding: '6px 10px' }}>Completed / Cancelled</th>
                    <th style={{ padding: '6px 10px' }}>Trigger Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: t.muted }}>No release runs.</td></tr>
                  )}
                  {runs.map(r => (
                    <tr key={r.id} style={{ borderTop: `1px dashed ${t.border}` }}>
                      <td style={{ padding: '6px 10px', color: t.ink }}>{r.source}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: statusColor(r.status, t) }}>{r.status}</td>
                      <td style={{ padding: '6px 10px', color: t.muted }}>{new Date(r.startedAt).toLocaleString()}</td>
                      <td style={{ padding: '6px 10px', color: t.muted }}>
                        {r.completedAt ? new Date(r.completedAt).toLocaleString() : r.cancelledAt ? new Date(r.cancelledAt).toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '6px 10px', color: t.muted }}>
                        {r.triggeringSwitchId ? `switch:${r.triggeringSwitchId.slice(0, 8)}` : r.relayConnectionId ? `relay:${r.relayConnectionId.slice(0, 8)}` : '—'}
                      </td>
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
