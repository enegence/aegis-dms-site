import { Link } from 'react-router-dom';

interface BillingActionsProps {
  hasActivePlan: boolean;
  onManageBilling: () => void;
  isPortalLoading: boolean;
  pricingUrl: string;
}

export function BillingActions({
  hasActivePlan,
  onManageBilling,
  isPortalLoading,
  pricingUrl,
}: BillingActionsProps) {
  return (
    <div className="p-4 bg-brand-surface border border-brand-border rounded-lg space-y-3">
      {hasActivePlan ? (
        <>
          <button
            onClick={onManageBilling}
            disabled={isPortalLoading}
            className="w-full font-sans text-sm font-semibold text-white bg-brand-accent px-4 py-2 rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPortalLoading ? 'Opening portal...' : 'Manage billing in Stripe'}
          </button>
          <p className="font-sans text-xs text-brand-muted text-center">
            Update payment method, view invoices, or cancel your subscription.
          </p>
        </>
      ) : (
        <>
          <p className="font-sans text-sm text-brand-muted">
            Choose <strong className="text-brand-ink">Aegis Relay</strong> to connect a self-hosted
            instance, or <strong className="text-brand-ink">Aegis Hosted</strong> for the fully
            managed app.
          </p>
          <Link
            to={pricingUrl}
            className="inline-block font-sans text-sm font-semibold text-white bg-brand-accent px-4 py-2 rounded hover:opacity-90 transition-opacity"
          >
            View pricing &rarr;
          </Link>
        </>
      )}

      {hasActivePlan && (
        <div className="pt-1 border-t border-brand-border">
          <Link
            to={pricingUrl}
            className="font-sans text-xs text-brand-accent hover:underline"
          >
            View all plans
          </Link>
        </div>
      )}
    </div>
  );
}
