import { useEffect, useState } from 'react';
import { get, post } from '../../lib/api';
import { PlanStatusCard } from '../../components/billing/PlanStatusCard';
import { BillingActions } from '../../components/billing/BillingActions';

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

  if (error) return <div className="p-8 text-brand-danger font-sans">{error}</div>;
  if (!summary) return <div className="p-8 text-brand-muted font-sans">Loading...</div>;

  const hasActivePlan = summary.hasRelay || summary.hasHosted;

  return (
    <div className="min-h-screen bg-brand-bg p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-hand text-4xl font-bold mb-1 text-brand-ink">Billing</h1>
        <p className="font-sans text-sm text-brand-muted mb-6">
          Manage your subscription and payment details.
        </p>

        {/* Plan cards */}
        {summary.subscriptions.length > 0 ? (
          <div className="space-y-3 mb-6">
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
          <div className="mb-6 p-4 bg-brand-surface border border-dashed border-brand-border rounded-lg">
            <p className="font-sans text-sm text-brand-muted">No active subscriptions.</p>
          </div>
        )}

        {/* Actions */}
        <BillingActions
          hasActivePlan={hasActivePlan}
          onManageBilling={handleManageBilling}
          isPortalLoading={portalLoading}
          pricingUrl={summary.pricingUrl}
        />

        {portalError && (
          <p className="mt-3 font-sans text-sm text-brand-danger">{portalError}</p>
        )}
      </div>
    </div>
  );
}
