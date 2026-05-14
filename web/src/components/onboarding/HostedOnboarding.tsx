import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import TrustModelCard from './TrustModelCard';
import { get, getTrustStatus, type TrustStatus } from '../../lib/api';
import type { DashboardSummary } from '../../lib/dashboard';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChecklistItem {
  key: string;
  label: string;
  description: string;
  complete: boolean;
  required: boolean;
  linkTo?: string;
  linkLabel?: string;
}

interface HostedOnboardingProps {
  /**
   * Called when all required steps are complete so the parent can hide the
   * onboarding banner and show the normal dashboard view.
   */
  onComplete?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 flex-shrink-0">
      <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="2,6 5,9 10,3" />
      </svg>
    </span>
  );
}

function CircleIcon({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border-2 border-brand-border text-brand-muted flex-shrink-0 font-sans text-xs font-semibold">
      {n}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * HostedOnboarding — full checklist UI for Aegis Hosted onboarding.
 *
 * Shows 6 checklist items; derives completion state from:
 *   - trust-status API  → trust model acknowledged
 *   - dashboard API     → contact count, estate item count, switch count
 * The last two items (readiness review, test notification) are advisory/placeholder.
 */
export default function HostedOnboarding({ onComplete }: HostedOnboardingProps) {
  const [trust, setTrust] = useState<TrustStatus | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [t, d] = await Promise.all([
        getTrustStatus(),
        get<DashboardSummary>('/api/dashboard'),
      ]);
      setTrust(t);
      setDashboard(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load onboarding status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const trustAcknowledged = trust?.acknowledged ?? false;
  const hasContact = (dashboard?.contactCount ?? 0) > 0;
  const hasEstateItem = (dashboard?.estateItemCount ?? 0) > 0;
  const hasSwitch = (dashboard?.activeSwitchCount ?? 0) > 0 ||
    (dashboard?.warningSwitchCount ?? 0) > 0 ||
    (dashboard?.triggeredSwitchCount ?? 0) > 0;

  // Check for any switch in the data (armed + warning + triggered covers "created a switch draft")
  const hasSwitchAny = hasSwitch;

  const allRequiredComplete =
    trustAcknowledged && hasContact && hasEstateItem && hasSwitchAny;

  // Notify parent when all required steps are done
  useEffect(() => {
    if (allRequiredComplete && onComplete) {
      onComplete();
    }
  }, [allRequiredComplete, onComplete]);

  const items: ChecklistItem[] = [
    {
      key: 'trust_model',
      label: 'Accept Hosted trust model',
      description: 'Acknowledge how Aegis Hosted stores and processes your encrypted legacy packet.',
      complete: trustAcknowledged,
      required: true,
    },
    {
      key: 'add_contact',
      label: 'Add at least one contact',
      description: 'Contacts are the people who will receive your estate information when your switch triggers.',
      complete: hasContact,
      required: true,
      linkTo: '/contacts?new=true',
      linkLabel: 'Add a contact',
    },
    {
      key: 'add_estate_item',
      label: 'Add at least one estate item or instruction',
      description: 'Estate items are the accounts, assets, and instructions you want your contacts to receive.',
      complete: hasEstateItem,
      required: true,
      linkTo: '/estate?new=true',
      linkLabel: 'Add an estate item',
    },
    {
      key: 'create_switch',
      label: 'Create a switch draft',
      description: 'A switch defines when and how your information is released. Create and configure your first switch.',
      complete: hasSwitchAny,
      required: true,
      linkTo: '/switches?new=true',
      linkLabel: 'Create a switch',
    },
    {
      key: 'readiness',
      label: 'Review readiness checks',
      description: 'Confirm your security settings and review the readiness summary before arming.',
      complete: allRequiredComplete,
      required: false,
      linkTo: '/settings/security',
      linkLabel: 'Review security settings',
    },
    {
      key: 'test_notification',
      label: 'Test notification path (optional)',
      description: 'Send a test notification to verify your contacts will receive messages correctly.',
      complete: false,
      required: false,
      linkTo: '/contacts',
      linkLabel: 'View contacts',
    },
  ];

  const requiredItems = items.filter(i => i.required);
  const completedRequired = requiredItems.filter(i => i.complete).length;

  if (loading) {
    return (
      <div className="p-6 font-sans text-sm text-brand-muted">Loading onboarding status…</div>
    );
  }

  if (error) {
    return (
      <div className="p-6 font-sans text-sm text-brand-danger">{error}</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-hand text-xl font-bold text-brand-ink">
            Finish setting up Aegis Hosted
          </h2>
          <p className="font-sans text-xs text-brand-muted mt-0.5">
            {completedRequired} of {requiredItems.length} required steps complete
          </p>
        </div>
        {allRequiredComplete && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 font-sans text-xs font-semibold">
            <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="2,6 5,9 10,3" />
            </svg>
            Ready
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-brand-surface border border-brand-border rounded-full h-1.5">
        <div
          className="bg-brand-accent h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${Math.round((completedRequired / requiredItems.length) * 100)}%` }}
        />
      </div>

      {/* Trust model card — shown inline when not yet acknowledged */}
      {!trustAcknowledged && (
        <TrustModelCard
          alreadyAcknowledged={false}
          onAcknowledged={() => {
            setTrust(prev => prev ? { ...prev, acknowledged: true } : { acknowledged: true, version: 'hosted-v1', acknowledgedAt: new Date().toISOString() });
          }}
        />
      )}

      {/* Checklist */}
      <div className="divide-y divide-brand-border border border-brand-border rounded-xl overflow-hidden">
        {items.map((item, idx) => (
          <div
            key={item.key}
            className={`flex items-start gap-3 px-4 py-3 bg-brand-surface ${
              item.complete ? 'opacity-80' : ''
            }`}
          >
            <div className="mt-0.5">
              {item.complete ? <CheckIcon /> : <CircleIcon n={idx + 1} />}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`font-sans text-sm font-medium ${
                  item.complete ? 'text-brand-muted line-through' : 'text-brand-ink'
                }`}
              >
                {item.label}
                {!item.required && (
                  <span className="ml-2 font-sans text-xs font-normal text-brand-muted no-underline">(optional)</span>
                )}
              </p>
              <p className="font-sans text-xs text-brand-muted mt-0.5 leading-relaxed">
                {item.description}
              </p>
              {!item.complete && item.linkTo && (
                <Link
                  to={item.linkTo}
                  className="inline-block mt-1.5 font-sans text-xs text-brand-accent hover:underline"
                >
                  {item.linkLabel} &rarr;
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quick links footer */}
      <div className="flex flex-wrap gap-3 pt-1">
        <span className="font-sans text-xs text-brand-muted">Quick links:</span>
        {[
          { to: '/contacts', label: 'Contacts' },
          { to: '/estate', label: 'Estate' },
          { to: '/switches', label: 'Switches' },
          { to: '/settings/security', label: 'Security settings' },
          { to: '/billing', label: 'Billing' },
        ].map(link => (
          <Link
            key={link.to}
            to={link.to}
            className="font-sans text-xs text-brand-accent hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
