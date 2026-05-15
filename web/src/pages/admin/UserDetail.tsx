import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get } from '../../lib/api';

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
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    get<{ user: AdminUserDetail }>(`/api/admin/users/${id}`)
      .then(d => setUser(d.user))
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) return <div className="p-8 text-brand-danger font-sans">{error}</div>;
  if (!user) return <div className="p-8 text-brand-muted font-sans">Loading...</div>;

  return (
    <div className="min-h-screen bg-brand-bg p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-hand text-4xl font-bold mb-1 text-brand-ink">User Detail</h1>
        <p className="font-sans text-sm text-brand-muted mb-6">{user.email}</p>

        <nav className="flex gap-4 mb-8 text-sm font-sans">
          <Link to="/admin" className="text-brand-muted hover:text-brand-ink">Overview</Link>
          <Link to="/admin/users" className="text-brand-muted hover:text-brand-ink">Users</Link>
          <span className="text-brand-accent font-semibold">User Detail</span>
        </nav>

        <div className="bg-brand-surface border border-brand-border rounded-lg p-6 space-y-4 font-sans text-sm">
          <section>
            <h2 className="font-semibold text-brand-ink mb-3 text-base">Account</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
              <dt className="text-brand-muted">User ID</dt>
              <dd className="text-brand-ink font-mono text-xs">{user.id}</dd>

              <dt className="text-brand-muted">Email</dt>
              <dd className="text-brand-ink">{user.email}</dd>

              <dt className="text-brand-muted">Display Name</dt>
              <dd className="text-brand-ink">{user.displayName}</dd>

              <dt className="text-brand-muted">Role</dt>
              <dd>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  user.role === 'admin' || user.role === 'sa'
                    ? 'bg-brand-accent text-white'
                    : 'bg-brand-surface text-brand-muted border border-brand-border'
                }`}>
                  {user.role}
                </span>
              </dd>

              <dt className="text-brand-muted">Email Verified</dt>
              <dd>{user.emailVerified
                ? <span className="text-green-600">Yes</span>
                : <span className="text-brand-muted">No</span>}
              </dd>

              <dt className="text-brand-muted">TOTP Enabled</dt>
              <dd>{user.totpEnabled
                ? <span className="text-green-600">Yes</span>
                : <span className="text-brand-muted">No</span>}
              </dd>

              <dt className="text-brand-muted">Timezone</dt>
              <dd className="text-brand-ink">{user.timezone || '—'}</dd>

              <dt className="text-brand-muted">Joined</dt>
              <dd className="text-brand-ink">{new Date(user.createdAt).toLocaleString()}</dd>
            </dl>
          </section>

          <hr className="border-brand-border" />

          <section>
            <h2 className="font-semibold text-brand-ink mb-3 text-base">Subscription</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
              <dt className="text-brand-muted">Plan</dt>
              <dd className="text-brand-ink">{user.subscriptionPlan ?? '—'}</dd>

              <dt className="text-brand-muted">Status</dt>
              <dd>
                {user.subscriptionStatus ? (
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing'
                      ? 'bg-green-100 text-green-700'
                      : user.subscriptionStatus === 'past_due' || user.subscriptionStatus === 'paused'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                  }`}>
                    {user.subscriptionStatus}
                  </span>
                ) : (
                  <span className="text-brand-muted">None</span>
                )}
              </dd>

              {user.subscriptionCurrentPeriodEnd && (
                <>
                  <dt className="text-brand-muted">Period End</dt>
                  <dd className="text-brand-ink">
                    {new Date(user.subscriptionCurrentPeriodEnd).toLocaleDateString()}
                  </dd>
                </>
              )}
            </dl>
          </section>

          <hr className="border-brand-border" />

          <section>
            <h2 className="font-semibold text-brand-ink mb-3 text-base">Activity</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
              <dt className="text-brand-muted">Relay Connections</dt>
              <dd className="text-brand-ink">{user.relayConnectionCount}</dd>

              <dt className="text-brand-muted">Active Release Runs</dt>
              <dd className="text-brand-ink">{user.activeReleaseRunCount}</dd>

              <dt className="text-brand-muted">Failed Notifications</dt>
              <dd className={user.failedNotificationCount > 0 ? 'text-brand-danger' : 'text-brand-ink'}>
                {user.failedNotificationCount}
              </dd>
            </dl>
          </section>
        </div>

        <div className="mt-4">
          <Link to="/admin/users" className="text-sm font-sans text-brand-muted hover:text-brand-ink">
            ← Back to Users
          </Link>
        </div>
      </div>
    </div>
  );
}
