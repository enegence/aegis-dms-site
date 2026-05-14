import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../../lib/api';
import { AccountSettings } from '../../components/settings/AccountSettings';
import { SecuritySettings } from '../../components/settings/SecuritySettings';
import { NotificationPreferenceSettings } from '../../components/settings/NotificationPreferenceSettings';

interface AccountInfo {
  email: string;
  displayName: string;
  emailVerified: boolean;
  timezone: string;
  createdAt: string;
}

type Tab = 'account' | 'security' | 'notifications' | 'billing' | 'relay';

const TABS: { id: Tab; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'security', label: 'Security' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'billing', label: 'Billing' },
  { id: 'relay', label: 'Relay' },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    get<AccountInfo>('/api/settings/account')
      .then(setAccount)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return <div className="p-8 text-brand-danger font-sans">{error}</div>;
  }

  if (!account) {
    return <div className="p-8 text-brand-muted font-sans">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-brand-bg p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-hand text-4xl font-bold mb-1 text-brand-ink">Settings</h1>
        <p className="font-sans text-sm text-brand-muted mb-6">
          Manage your account, security, and preferences.
        </p>

        {/* Tab navigation */}
        <nav className="flex gap-1 border-b border-brand-border mb-6 overflow-x-auto">
          {TABS.map(tab => {
            const isLink = tab.id === 'billing' || tab.id === 'relay';
            const href = tab.id === 'billing' ? '/app/billing' : '/relay';

            if (isLink) {
              return (
                <Link
                  key={tab.id}
                  to={href}
                  className="px-4 py-2 font-sans text-sm text-brand-muted hover:text-brand-ink whitespace-nowrap border-b-2 border-transparent hover:border-brand-muted transition-colors"
                >
                  {tab.label}
                </Link>
              );
            }

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'px-4 py-2 font-sans text-sm whitespace-nowrap border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'text-brand-ink border-brand-accent font-medium'
                    : 'text-brand-muted border-transparent hover:text-brand-ink hover:border-brand-muted',
                ].join(' ')}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Tab content */}
        {activeTab === 'account' && (
          <AccountSettings account={account} onUpdated={setAccount} />
        )}
        {activeTab === 'security' && (
          <SecuritySettings emailVerified={account.emailVerified} />
        )}
        {activeTab === 'notifications' && (
          <NotificationPreferenceSettings />
        )}
      </div>
    </div>
  );
}
