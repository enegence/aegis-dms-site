import { useState } from 'react';
import { put } from '../../lib/api';

interface AccountInfo {
  email: string;
  displayName: string;
  emailVerified: boolean;
  timezone: string;
  createdAt: string;
}

interface Props {
  account: AccountInfo;
  onUpdated: (account: AccountInfo) => void;
}

export function AccountSettings({ account, onUpdated }: Props) {
  const [displayName, setDisplayName] = useState(account.displayName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await put<AccountInfo>('/api/settings/account', { displayName });
      onUpdated(updated);
      setSuccess('Profile updated.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const memberSince = new Date(account.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-hand text-2xl font-bold text-brand-ink mb-1">Account</h2>
        <p className="font-sans text-sm text-brand-muted">Your profile and account details.</p>
      </div>

      {/* Read-only info */}
      <div className="bg-brand-surface border border-brand-border rounded-lg p-4 space-y-3">
        <div>
          <p className="font-sans text-xs text-brand-muted uppercase tracking-wide">Email</p>
          <p className="font-sans text-sm text-brand-ink mt-0.5">{account.email}</p>
          <p className="font-sans text-xs text-brand-muted mt-0.5 italic">
            Email changes are not supported in alpha.
          </p>
        </div>
        <div>
          <p className="font-sans text-xs text-brand-muted uppercase tracking-wide">Member since</p>
          <p className="font-sans text-sm text-brand-ink mt-0.5">{memberSince}</p>
        </div>
        <div>
          <p className="font-sans text-xs text-brand-muted uppercase tracking-wide">Email status</p>
          <p className="font-sans text-sm mt-0.5">
            {account.emailVerified ? (
              <span className="text-green-600 font-sans">Verified</span>
            ) : (
              <span className="text-amber-600 font-sans">Not verified</span>
            )}
          </p>
        </div>
      </div>

      {/* Editable form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="displayName" className="block font-sans text-sm font-medium text-brand-ink mb-1">
            Display name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            maxLength={200}
            required
            className="w-full border border-brand-border rounded px-3 py-2 font-sans text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
          />
        </div>

        {error && <p className="font-sans text-sm text-brand-danger">{error}</p>}
        {success && <p className="font-sans text-sm text-green-600">{success}</p>}

        <button
          type="submit"
          disabled={saving || displayName === account.displayName}
          className="px-4 py-2 bg-brand-accent text-white rounded font-sans text-sm hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
