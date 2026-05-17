import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import AppShell from '../../components/layout/AppShell';
import { buildNavItems } from '../../components/layout/navModel';
import { SketchCard, SectionTitle } from '../../components/ui';

interface AdminUserDetail {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  role: string;
  timezone: string;
  totpEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  relayConnectionCount: number;
  activeReleaseRunCount: number;
  failedNotificationCount: number;
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const t = useTheme();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    get<{ user: AdminUserDetail }>(`/api/admin/users/${id}`)
      .then(d => setUser(d.user))
      .catch((e: Error) => setError(e.message));
  }, [id]);

  const dt = { color: t.muted, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 } as const;
  const dd = { color: t.ink, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 } as const;
  const h2 = { fontFamily: "'Caveat',cursive", fontSize: 20, fontWeight: 700, color: t.ink, margin: '0 0 10px' } as const;

  return (
    <AppShell navItems={buildNavItems(true)} releaseTo="/release">
      {error ? (
        <div role="alert" style={{ color: t.danger, fontFamily: "'JetBrains Mono',monospace" }}>{error}</div>
      ) : !user ? (
        <div style={{ color: t.muted, fontFamily: "'JetBrains Mono',monospace" }}>Loading...</div>
      ) : (
        <>
          <SectionTitle sub={user.email}>User Detail</SectionTitle>
          <nav style={{ display: 'flex', gap: 16, marginBottom: 20, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
            <Link to="/admin" style={{ color: t.muted, textDecoration: 'none' }}>Overview</Link>
            <Link to="/admin/users" style={{ color: t.muted, textDecoration: 'none' }}>Users</Link>
            <span style={{ color: t.accent, fontWeight: 700 }}>User Detail</span>
          </nav>

          <SketchCard style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <section>
              <div style={h2}>Account</div>
              <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 24, rowGap: 8, margin: 0 }}>
                <dt style={dt}>User ID</dt><dd style={dd}>{user.id}</dd>
                <dt style={dt}>Email</dt><dd style={dd}>{user.email}</dd>
                <dt style={dt}>Display Name</dt><dd style={dd}>{user.displayName}</dd>
                <dt style={dt}>Role</dt>
                <dd><span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, background: user.role === 'admin' || user.role === 'sa' ? t.accent : t.border, color: user.role === 'admin' || user.role === 'sa' ? '#fff' : t.muted }}>{user.role}</span></dd>
                <dt style={dt}>Email Verified</dt><dd style={{ ...dd, color: user.emailVerified ? '#27AE60' : t.muted }}>{user.emailVerified ? 'Yes' : 'No'}</dd>
                <dt style={dt}>TOTP Enabled</dt><dd style={{ ...dd, color: user.totpEnabled ? '#27AE60' : t.muted }}>{user.totpEnabled ? 'Yes' : 'No'}</dd>
                <dt style={dt}>Timezone</dt><dd style={dd}>{user.timezone || '—'}</dd>
                <dt style={dt}>Joined</dt><dd style={dd}>{new Date(user.createdAt).toLocaleString()}</dd>
              </dl>
            </section>

            <hr style={{ border: 'none', borderTop: `1px dashed ${t.border}` }} />

            <section>
              <div style={h2}>Subscription</div>
              <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 24, rowGap: 8, margin: 0 }}>
                <dt style={dt}>Plan</dt><dd style={dd}>{user.subscriptionPlan ?? '—'}</dd>
                <dt style={dt}>Status</dt>
                <dd style={dd}>{user.subscriptionStatus ?? <span style={{ color: t.muted }}>None</span>}</dd>
                {user.subscriptionCurrentPeriodEnd && (
                  <>
                    <dt style={dt}>Period End</dt>
                    <dd style={dd}>{new Date(user.subscriptionCurrentPeriodEnd).toLocaleDateString()}</dd>
                  </>
                )}
              </dl>
            </section>

            <hr style={{ border: 'none', borderTop: `1px dashed ${t.border}` }} />

            <section>
              <div style={h2}>Activity</div>
              <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 24, rowGap: 8, margin: 0 }}>
                <dt style={dt}>Relay Connections</dt><dd style={dd}>{user.relayConnectionCount}</dd>
                <dt style={dt}>Active Release Runs</dt><dd style={dd}>{user.activeReleaseRunCount}</dd>
                <dt style={dt}>Failed Notifications</dt>
                <dd style={{ ...dd, color: user.failedNotificationCount > 0 ? t.danger : t.ink }}>{user.failedNotificationCount}</dd>
              </dl>
            </section>
          </SketchCard>

          <div style={{ marginTop: 16 }}>
            <Link to="/admin/users" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, textDecoration: 'none' }}>← Back to Users</Link>
          </div>
        </>
      )}
    </AppShell>
  );
}
