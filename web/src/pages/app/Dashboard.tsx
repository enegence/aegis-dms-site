import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard, type DashboardSummary } from '../../lib/dashboard';
import { get, getOnboardingState, type OnboardingState } from '../../lib/api';

interface ReleaseOverview {
  packetCount: number;
  activeRunCount: number;
}

/**
 * Returns true when the hosted onboarding banner should be shown.
 * Conditions: user has an active hosted subscription AND onboarding is not yet complete.
 */
function shouldShowHostedOnboarding(onboarding: OnboardingState | null): boolean {
  if (!onboarding) return false;
  if (onboarding.completedAt) return false;
  return onboarding.subscription.hasHosted;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [release, setRelease] = useState<ReleaseOverview | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getDashboard().then(setData).catch((e: Error) => setError(e.message));
    getOnboardingState().then(setOnboarding).catch(() => {}); // non-critical
    Promise.all([
      get<{ packets: unknown[] }>('/api/app/packets'),
      get<{ releaseRuns: { status: string }[] }>('/api/app/release-runs'),
    ]).then(([pd, rd]) => {
      const activeRuns = rd.releaseRuns.filter(
        r => !['completed', 'cancelled', 'failed'].includes(r.status),
      );
      setRelease({ packetCount: pd.packets.length, activeRunCount: activeRuns.length });
    }).catch(() => {}); // non-critical
  }, []);

  if (error) return <div className="p-8 text-brand-danger font-sans">{error}</div>;
  if (!data) return <div className="p-8 text-brand-muted font-sans">Loading...</div>;

  return (
    <div className="min-h-screen bg-brand-bg p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-hand text-4xl font-bold mb-1 text-brand-ink">
          Aegis Dashboard
        </h1>
        <p className="font-sans text-sm text-brand-muted mb-6">
          Welcome, {data.user.displayName}
        </p>

        {!data.user.emailVerified && (
          <div className="mb-4 p-3 bg-brand-surface border border-brand-border rounded text-brand-danger font-sans text-sm">
            Please verify your email address to arm switches.
          </div>
        )}

        {/* Hosted onboarding banner */}
        {!onboardingDismissed && shouldShowHostedOnboarding(onboarding) && (
          <div className="mb-6 p-4 bg-brand-surface border border-brand-accent rounded-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-sans text-sm font-semibold text-brand-ink">
                  Finish setting up Aegis Hosted
                </p>
                <p className="font-sans text-xs text-brand-muted mt-1">
                  Complete your onboarding checklist to get your legacy switch ready.
                </p>
              </div>
              <button
                onClick={() => setOnboardingDismissed(true)}
                className="flex-shrink-0 font-sans text-xs text-brand-muted hover:text-brand-ink transition-colors"
                aria-label="Dismiss onboarding banner"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 flex gap-3">
              <Link
                to="/onboarding"
                className="font-sans text-xs font-semibold text-white bg-brand-accent px-3 py-1.5 rounded hover:opacity-90 transition-opacity"
              >
                Continue setup &rarr;
              </Link>
              <button
                onClick={() => setOnboardingDismissed(true)}
                className="font-sans text-xs text-brand-muted hover:text-brand-ink transition-colors"
              >
                Remind me later
              </button>
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Estate Items" count={data.estateItemCount} to="/estate" />
          <StatCard label="Contacts" count={data.contactCount} to="/contacts" />
          <StatCard
            label="Active Switches"
            count={data.activeSwitchCount}
            to="/switches"
            badge={
              data.triggeredSwitchCount > 0
                ? `${data.triggeredSwitchCount} triggered`
                : data.warningSwitchCount > 0
                ? `${data.warningSwitchCount} warning`
                : undefined
            }
            badgeColor={data.triggeredSwitchCount > 0 ? 'danger' : 'warning'}
          />
          <StatCard
            label="Relay Connections"
            count={data.relayConnectionCount}
            to="/relay"
            badge={data.offlineRelayConnectionCount > 0 ? `${data.offlineRelayConnectionCount} offline` : undefined}
            badgeColor="danger"
          />
        </div>

        {/* Subscription */}
        <div className="mb-6 p-4 bg-brand-surface border border-brand-border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-sans text-sm text-brand-muted">Plan: </span>
              <span className="font-sans text-sm font-semibold text-brand-ink">
                {data.subscription.plan ?? 'None'}
              </span>
              <span className="ml-2 font-sans text-xs text-brand-muted">
                ({data.subscription.status ?? 'inactive'})
              </span>
            </div>
            <a
              href="/billing"
              className="font-sans text-xs text-brand-accent hover:underline"
            >
              Manage billing
            </a>
          </div>
        </div>

        {/* Next switch */}
        {data.nextSwitch && (
          <div className="mb-6 p-4 bg-brand-surface border border-brand-border rounded-lg">
            <p className="font-sans text-xs text-brand-muted mb-1">Next action</p>
            <p className="font-sans text-sm font-semibold text-brand-ink">
              {data.nextSwitch.name}
            </p>
            {data.nextActionAt && (
              <p className="font-sans text-xs text-brand-muted">
                {new Date(data.nextActionAt).toLocaleString()}
              </p>
            )}
            <Link to="/switches" className="font-sans text-xs text-brand-accent hover:underline mt-1 inline-block">
              View switches &rarr;
            </Link>
          </div>
        )}

        {/* Release health cards */}
        {release !== null && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Link
              to="/release"
              className="p-4 bg-brand-surface border border-brand-border rounded-lg hover:border-brand-accent transition-colors"
            >
              <p className="font-hand text-3xl font-bold text-brand-ink">{release.packetCount}</p>
              <p className="font-sans text-xs text-brand-muted">Packets stored</p>
            </Link>
            <Link
              to="/release"
              className={`p-4 bg-brand-surface border rounded-lg hover:border-brand-accent transition-colors ${
                release.activeRunCount > 0 ? 'border-brand-danger' : 'border-brand-border'
              }`}
            >
              <p className={`font-hand text-3xl font-bold ${release.activeRunCount > 0 ? 'text-brand-danger' : 'text-brand-ink'}`}>
                {release.activeRunCount}
              </p>
              <p className="font-sans text-xs text-brand-muted">Active release runs</p>
            </Link>
          </div>
        )}

        {/* Empty state prompts */}
        {data.estateItemCount === 0 && (
          <EmptyPrompt to="/estate" text="Add your first estate item to get started." />
        )}
        {data.contactCount === 0 && (
          <EmptyPrompt to="/contacts" text="Add trusted contacts who will receive your information." />
        )}
        {data.activeSwitchCount === 0 && data.estateItemCount > 0 && data.contactCount > 0 && (
          <EmptyPrompt to="/switches" text="Create and arm your first switch." />
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  count,
  to,
  badge,
  badgeColor,
}: {
  label: string;
  count: number;
  to: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <Link
      to={to}
      className="block p-4 bg-brand-surface border border-brand-border rounded-lg hover:border-brand-accent transition-colors"
    >
      <p className="font-hand text-3xl font-bold text-brand-ink">{count}</p>
      <p className="font-sans text-xs text-brand-muted">{label}</p>
      {badge && (
        <span
          className={`font-sans text-xs ${
            badgeColor === 'danger' ? 'text-brand-danger' : 'text-amber-600'
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function EmptyPrompt({ to, text }: { to: string; text: string }) {
  return (
    <div className="mb-3 p-3 bg-brand-surface border border-dashed border-brand-border rounded">
      <Link to={to} className="font-sans text-sm text-brand-accent hover:underline">
        {text}
      </Link>
    </div>
  );
}
