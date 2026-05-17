import { useEffect, useState } from 'react';
import { get, post } from '../../lib/api';
import { PlanStatusCard } from '../../components/billing/PlanStatusCard';
import { BillingActions } from '../../components/billing/BillingActions';
import { useAuth } from '../../App';
import { useTheme } from '../../lib/theme';
import AppShell from '../../components/layout/AppShell';
import { buildNavItems } from '../../components/layout/navModel';
import { SketchCard, SectionTitle } from '../../components/ui';

interface SubscriptionSummary {
  id: string;
  plan: 'relay' | 'hosted';
  status: string;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
}

interface BillingSummary {
  customerId: string | null;
  subscriptions: SubscriptionSummary[];
  hasRelay: boolean;
  hasHosted: boolean;
  pricingUrl: string;
}

export default function Billing() {
  const { user } = useAuth();
  const t = useTheme();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [error, setError] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState('');

  useEffect(() => {
    get<BillingSummary>('/api/billing/summary')
      .then(setSummary)
      .catch((e: Error) => setError(e.message));
  }, []);

  async function handleManageBilling() {
    setPortalLoading(true);
    setPortalError('');
    try {
      const { url } = await post<{ url: string }>('/api/billing/portal', {
        returnUrl: `${window.location.origin}/app/billing`,
      });
      window.location.href = url;
    } catch (e: unknown) {
      setPortalError(e instanceof Error ? e.message : 'Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'sa';
  const hasActivePlan = !!summary && (summary.hasRelay || summary.hasHosted);

  return (
    <AppShell navItems={buildNavItems(isAdmin)} releaseTo="/release">
      <SectionTitle sub="MANAGE YOUR SUBSCRIPTION AND PAYMENT DETAILS">Billing</SectionTitle>

      {error && <div style={{ color: t.danger, fontFamily: "'JetBrains Mono',monospace" }}>{error}</div>}
      {!error && !summary && <div style={{ color: t.muted, fontFamily: "'JetBrains Mono',monospace" }}>Loading...</div>}

      {summary && (
        <>
          {summary.subscriptions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {summary.subscriptions.map(sub => (
                <PlanStatusCard
                  key={sub.id}
                  plan={sub.plan}
                  status={sub.status}
                  currentPeriodEnd={sub.currentPeriodEnd}
                  cancelledAt={sub.cancelledAt}
                />
              ))}
            </div>
          ) : (
            <SketchCard style={{ marginBottom: 24 }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted }}>No active subscriptions.</span>
            </SketchCard>
          )}

          <BillingActions
            hasActivePlan={hasActivePlan}
            onManageBilling={handleManageBilling}
            isPortalLoading={portalLoading}
            pricingUrl={summary.pricingUrl}
          />

          {portalError && (
            <p style={{ marginTop: 12, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.danger }}>{portalError}</p>
          )}
        </>
      )}
    </AppShell>
  );
}
