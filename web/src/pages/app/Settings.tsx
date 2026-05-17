import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../../lib/api';
import { AccountSettings } from '../../components/settings/AccountSettings';
import { SecuritySettings } from '../../components/settings/SecuritySettings';
import { NotificationPreferenceSettings } from '../../components/settings/NotificationPreferenceSettings';
import { useAuth } from '../../App';
import { useTheme } from '../../lib/theme';
import AppShell from '../../components/layout/AppShell';
import { buildNavItems } from '../../components/layout/navModel';
import { SectionTitle } from '../../components/ui';

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
  const { user } = useAuth();
  const t = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    get<AccountInfo>('/api/settings/account')
      .then(setAccount)
      .catch((e: Error) => setError(e.message));
  }, []);

  const isAdmin = user?.role === 'admin' || user?.role === 'sa';

  return (
    <AppShell navItems={buildNavItems(isAdmin)} releaseTo="/release">
      <SectionTitle sub="MANAGE YOUR ACCOUNT, SECURITY, AND PREFERENCES">Settings</SectionTitle>

      {error && <div style={{ color: t.danger, fontFamily: "'JetBrains Mono',monospace" }}>{error}</div>}
      {!error && !account && <div style={{ color: t.muted, fontFamily: "'JetBrains Mono',monospace" }}>Loading…</div>}

      {account && (
        <>
          <nav style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
            {TABS.map(tab => {
              const isLink = tab.id === 'billing' || tab.id === 'relay';
              const active = !isLink && activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => (isLink ? navigate(tab.id === 'billing' ? '/app/billing' : '/relay') : setActiveTab(tab.id))}
                  style={{
                    fontFamily: "'Caveat',cursive", fontSize: 18, fontWeight: active ? 700 : 400,
                    padding: '6px 16px', cursor: 'pointer',
                    background: active ? t.ink : 'transparent',
                    color: active ? t.bg : t.ink,
                    border: `2px solid ${active ? t.ink : t.border}`,
                    borderRadius: '3px 8px 3px 8px / 8px 3px 8px 3px',
                    transform: active ? 'rotate(-0.4deg)' : 'none', transition: 'all 0.1s',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {activeTab === 'account' && <AccountSettings account={account} onUpdated={setAccount} />}
          {activeTab === 'security' && <SecuritySettings emailVerified={account.emailVerified} />}
          {activeTab === 'notifications' && <NotificationPreferenceSettings />}
        </>
      )}
    </AppShell>
  );
}
