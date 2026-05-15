import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../../lib/api';

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
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    get<{ users: AdminUser[] }>('/api/admin/users')
      .then(d => setUsers(d.users))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="p-8 font-sans">
        <div role="alert" aria-live="assertive" className="text-brand-danger">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="font-hand text-4xl font-bold mb-1 text-brand-ink">Users</h1>
        <p className="font-sans text-sm text-brand-muted mb-6" aria-live="polite">{users.length} registered</p>

        <nav aria-label="Admin navigation" className="flex gap-4 mb-8 text-sm font-sans">
          <Link to="/admin" className="text-brand-muted hover:text-brand-ink">Overview</Link>
          <Link to="/admin/users" className="text-brand-accent font-semibold" aria-current="page">Users</Link>
          <Link to="/admin/relay" className="text-brand-muted hover:text-brand-ink">Relay</Link>
          <Link to="/admin/release-runs" className="text-brand-muted hover:text-brand-ink">Release Runs</Link>
        </nav>

        <div className="overflow-x-auto">
          <table aria-label="Registered users" className="w-full text-sm font-sans border border-brand-border rounded-lg overflow-hidden">
            <thead className="bg-brand-surface text-brand-muted">
              <tr>
                <th scope="col" className="px-4 py-2 text-left">Email</th>
                <th scope="col" className="px-4 py-2 text-left">Display Name</th>
                <th scope="col" className="px-4 py-2 text-left">Role</th>
                <th scope="col" className="px-4 py-2 text-left">Verified</th>
                <th scope="col" className="px-4 py-2 text-left">TOTP</th>
                <th scope="col" className="px-4 py-2 text-left">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-brand-muted">No users.</td>
                </tr>
              )}
              {users.map(u => (
                <tr key={u.id} className="border-t border-brand-border hover:bg-brand-surface/50">
                  <td className="px-4 py-2 text-brand-ink">{u.email}</td>
                  <td className="px-4 py-2 text-brand-muted">{u.displayName}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      u.role === 'admin' || u.role === 'sa'
                        ? 'bg-brand-accent text-white'
                        : 'bg-brand-surface text-brand-muted'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {u.emailVerified
                      ? <span className="text-green-600" aria-label="Email verified">✓</span>
                      : <span className="text-brand-muted" aria-label="Email not verified">—</span>}
                  </td>
                  <td className="px-4 py-2">
                    {u.totpEnabled
                      ? <span className="text-green-600" aria-label="TOTP enabled">✓</span>
                      : <span className="text-brand-muted" aria-label="TOTP not enabled">—</span>}
                  </td>
                  <td className="px-4 py-2 text-brand-muted">
                    {new Date(u.createdAt).toLocaleDateString()}
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
