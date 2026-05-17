import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import AppShell from '../../components/layout/AppShell';
import { buildNavItems } from '../../components/layout/navModel';
import { SketchCard, SectionTitle } from '../../components/ui';

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

export default function AdminUsers() {
  const t = useTheme();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    get<{ users: AdminUser[] }>('/api/admin/users')
      .then(d => setUsers(d.users))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <AppShell navItems={buildNavItems(true)} releaseTo="/release">
      {error ? (
        <div role="alert" aria-live="assertive" style={{ color: t.danger, fontFamily: "'JetBrains Mono',monospace" }}>{error}</div>
      ) : (
        <>
          <SectionTitle sub="ADMIN · USERS">Users</SectionTitle>
          <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, margin: '-12px 0 16px' }} aria-live="polite">{users.length} registered</p>

          <nav aria-label="Admin navigation" style={{ display: 'flex', gap: 16, marginBottom: 20, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
            <Link to="/admin" style={{ color: t.muted, textDecoration: 'none' }}>Overview</Link>
            <Link to="/admin/users" style={{ color: t.accent, fontWeight: 700, textDecoration: 'none' }} aria-current="page">Users</Link>
            <Link to="/admin/relay" style={{ color: t.muted, textDecoration: 'none' }}>Relay</Link>
            <Link to="/admin/release-runs" style={{ color: t.muted, textDecoration: 'none' }}>Release Runs</Link>
          </nav>

          <SketchCard>
            <div style={{ overflowX: 'auto' }}>
              <table aria-label="Registered users" style={{ width: '100%', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: t.muted, textAlign: 'left' }}>
                    <th scope="col" style={{ padding: '6px 10px' }}>Email</th>
                    <th scope="col" style={{ padding: '6px 10px' }}>Display Name</th>
                    <th scope="col" style={{ padding: '6px 10px' }}>Role</th>
                    <th scope="col" style={{ padding: '6px 10px' }}>Verified</th>
                    <th scope="col" style={{ padding: '6px 10px' }}>TOTP</th>
                    <th scope="col" style={{ padding: '6px 10px' }}>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: t.muted }}>No users.</td></tr>
                  )}
                  {users.map(u => (
                    <tr key={u.id} style={{ borderTop: `1px dashed ${t.border}` }}>
                      <td style={{ padding: '6px 10px', color: t.ink }}>{u.email}</td>
                      <td style={{ padding: '6px 10px', color: t.muted }}>{u.displayName}</td>
                      <td style={{ padding: '6px 10px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, background: u.role === 'admin' || u.role === 'sa' ? t.accent : t.border, color: u.role === 'admin' || u.role === 'sa' ? '#fff' : t.muted }}>{u.role}</span>
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        {u.emailVerified ? <span style={{ color: '#27AE60' }} aria-label="Email verified">✓</span> : <span style={{ color: t.muted }} aria-label="Email not verified">—</span>}
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        {u.totpEnabled ? <span style={{ color: '#27AE60' }} aria-label="TOTP enabled">✓</span> : <span style={{ color: t.muted }} aria-label="TOTP not enabled">—</span>}
                      </td>
                      <td style={{ padding: '6px 10px', color: t.muted }}>{new Date(u.createdAt).toLocaleDateString()}</td>
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
