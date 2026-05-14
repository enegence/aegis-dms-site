import { useState } from 'react';
import { post } from '../../lib/api';

interface Props {
  emailVerified: boolean;
}

export function SecuritySettings({ emailVerified }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      await post('/api/security/change-password', { currentPassword, newPassword });
      setSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-hand text-2xl font-bold text-brand-ink mb-1">Security</h2>
        <p className="font-sans text-sm text-brand-muted">Manage your password and security settings.</p>
      </div>

      {/* Session info */}
      <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
        <p className="font-sans text-sm text-brand-ink">
          You are signed in on this device.
        </p>
        <p className="font-sans text-xs text-brand-muted mt-1">
          Email verification status:{' '}
          {emailVerified ? (
            <span className="text-green-600">Verified</span>
          ) : (
            <span className="text-amber-600">Not verified — check your inbox</span>
          )}
        </p>
      </div>

      {/* Password change form */}
      <div>
        <h3 className="font-sans text-base font-semibold text-brand-ink mb-3">Change password</h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="block font-sans text-sm font-medium text-brand-ink mb-1">
              Current password
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-brand-border rounded px-3 py-2 font-sans text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="block font-sans text-sm font-medium text-brand-ink mb-1">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
              className="w-full border border-brand-border rounded px-3 py-2 font-sans text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
            <p className="font-sans text-xs text-brand-muted mt-1">Minimum 8 characters.</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block font-sans text-sm font-medium text-brand-ink mb-1">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full border border-brand-border rounded px-3 py-2 font-sans text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
          </div>

          {error && <p className="font-sans text-sm text-brand-danger">{error}</p>}
          {success && <p className="font-sans text-sm text-green-600">{success}</p>}

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-brand-accent text-white rounded font-sans text-sm hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Changing…' : 'Change password'}
          </button>
        </form>
      </div>

      {/* TOTP placeholder */}
      <div className="border border-dashed border-brand-border rounded-lg p-4">
        <h3 className="font-sans text-base font-semibold text-brand-ink mb-1">Two-factor authentication</h3>
        <p className="font-sans text-sm text-brand-muted">Coming soon.</p>
      </div>
    </div>
  );
}
