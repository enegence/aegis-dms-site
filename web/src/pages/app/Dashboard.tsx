import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard, type DashboardSummary } from '../../lib/dashboard';
import { get, getOnboardingState, type OnboardingState } from '../../lib/api';
import { useAuth } from '../../App';
import { useTheme } from '../../lib/theme';
import AppShell from '../../components/layout/AppShell';
import { buildNavItems } from '../../components/layout/navModel';
import { SketchCard, SectionTitle, StatPill, InkButton } from '../../components/ui';
import { IconCheck, IconHeartbeat, IconCloud } from '../../components/icons';

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

function countdownParts(iso: string | null | undefined): { d: number; h: number; m: number } | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (isNaN(ms)) return null;
  const clamped = Math.max(0, ms);
  return {
    d: Math.floor(clamped / 86_400_000),
    h: Math.floor((clamped % 86_400_000) / 3_600_000),
    m: Math.floor((clamped % 3_600_000) / 60_000),
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const t = useTheme();
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

  const isAdmin = user?.role === 'admin' || user?.role === 'sa';
  const navItems = buildNavItems(isAdmin);

  const statusLines = data
    ? [
        `Switches: ${data.activeSwitchCount} active`,
        `Plan: ${data.subscription.plan ?? 'none'}`,
        `Relay: ${data.relayConnectionCount} linked`,
      ]
    : undefined;

  const body = () => {
    if (error) return <div style={{ color: t.danger, fontFamily: "'JetBrains Mono',monospace" }}>{error}</div>;
    if (!data) return <div style={{ color: t.muted, fontFamily: "'JetBrains Mono',monospace" }}>Loading...</div>;

    const cd = countdownParts(data.nextActionAt);
    const warning = data.triggeredSwitchCount > 0 || data.warningSwitchCount > 0;
    const statusColor = warning ? t.danger : t.accent;

    return (
      <div>
        <SectionTitle sub={data.nextSwitch ? `NEXT: ${data.nextSwitch.name.toUpperCase()}` : 'NO ACTIVE SWITCH'}>
          Still Alive Dashboard
        </SectionTitle>
        <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, margin: '-12px 0 18px' }}>
          Welcome, {data.user.displayName}
        </p>

        {!data.user.emailVerified && (
          <SketchCard tilt={-0.3} style={{ marginBottom: 16, borderColor: t.danger }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.danger }}>
              Please verify your email address to arm switches.
            </span>
          </SketchCard>
        )}

        {!onboardingDismissed && shouldShowHostedOnboarding(onboarding) && (
          <SketchCard style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22, fontWeight: 700, color: t.ink }}>
                  Finish setting up Aegis Hosted
                </div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, marginTop: 4 }}>
                  Complete your onboarding checklist to get your legacy switch ready.
                </div>
              </div>
              <button onClick={() => setOnboardingDismissed(true)} aria-label="Dismiss onboarding banner"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.muted, fontSize: 16 }}>✕</button>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
              <Link to="/onboarding" style={{ textDecoration: 'none' }}>
                <InkButton size="sm">Continue setup →</InkButton>
              </Link>
              <InkButton size="sm" variant="ghost" onClick={() => setOnboardingDismissed(true)}>Remind me later</InkButton>
            </div>
          </SketchCard>
        )}

        {/* Big heartbeat card */}
        <SketchCard style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
                time until release begins
              </div>
              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 64, fontWeight: 700, color: statusColor, lineHeight: 1, letterSpacing: '-2px' }}>
                {cd ? `${cd.d}d ${cd.h}h ${cd.m}m` : '—'}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: t.muted, marginTop: 8 }}>
                {data.nextActionAt
                  ? `Next action: ${new Date(data.nextActionAt).toLocaleString()}`
                  : 'No active switch scheduled'}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <Link to="/switches" style={{ textDecoration: 'none' }}>
                <InkButton size="lg">👋 Check in / Manage</InkButton>
              </Link>
            </div>
          </div>
        </SketchCard>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <Link to="/estate" style={{ textDecoration: 'none' }}><StatPill label="Legacy Items" value={data.estateItemCount} /></Link>
          <Link to="/contacts" style={{ textDecoration: 'none' }}><StatPill label="Contacts" value={data.contactCount} /></Link>
          <Link to="/switches" style={{ textDecoration: 'none' }}>
            <StatPill
              label={data.triggeredSwitchCount > 0 ? 'Triggered' : data.warningSwitchCount > 0 ? 'Warning' : 'Active Switches'}
              value={data.activeSwitchCount}
              accent={data.triggeredSwitchCount > 0 || data.warningSwitchCount > 0 ? t.danger : undefined}
            />
          </Link>
          <Link to="/relay" style={{ textDecoration: 'none' }}>
            <StatPill
              label={data.offlineRelayConnectionCount > 0 ? 'Relay Offline' : 'Relay'}
              value={<IconCloud size={22} color={data.offlineRelayConnectionCount > 0 ? t.danger : t.accent} />}
              accent={data.offlineRelayConnectionCount > 0 ? t.danger : undefined}
            />
          </Link>
        </div>

        {/* Subscription */}
        <SketchCard tilt={0.2} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.ink }}>
              Plan: <strong>{data.subscription.plan ?? 'None'}</strong>{' '}
              <span style={{ color: t.muted }}>({data.subscription.status ?? 'inactive'})</span>
            </div>
            <Link to="/app/billing" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.accent, textDecoration: 'none' }}>
              Manage billing →
            </Link>
          </div>
        </SketchCard>

        {/* Next switch */}
        {data.nextSwitch && (
          <SketchCard tilt={-0.2} style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Next action</div>
            <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22, fontWeight: 700, color: t.ink }}>{data.nextSwitch.name}</div>
            {data.nextActionAt && (
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted }}>{new Date(data.nextActionAt).toLocaleString()}</div>
            )}
            <Link to="/switches" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.accent, textDecoration: 'none', marginTop: 6, display: 'inline-block' }}>
              View switches →
            </Link>
          </SketchCard>
        )}

        {/* Release health */}
        {release !== null && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <Link to="/release" style={{ textDecoration: 'none' }}>
              <StatPill label="Packets stored" value={release.packetCount} />
            </Link>
            <Link to="/release" style={{ textDecoration: 'none' }}>
              <StatPill label="Active release runs" value={release.activeRunCount} accent={release.activeRunCount > 0 ? t.danger : undefined} />
            </Link>
          </div>
        )}

        {/* Empty-state prompts */}
        {data.estateItemCount === 0 && <EmptyPrompt to="/estate" text="Add your first estate item to get started." t={t} />}
        {data.contactCount === 0 && <EmptyPrompt to="/contacts" text="Add trusted contacts who will receive your information." t={t} />}
        {data.activeSwitchCount === 0 && data.estateItemCount > 0 && data.contactCount > 0 && (
          <EmptyPrompt to="/switches" text="Create and arm your first switch." t={t} />
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', alignItems: 'center', color: t.muted }}>
          <IconCheck size={16} color={t.accent} />
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
            {data.estateItemCount} items · {data.contactCount} contacts · {data.activeSwitchCount} active switches
          </span>
          <IconHeartbeat size={16} color={t.accent} />
        </div>
      </div>
    );
  };

  return (
    <AppShell navItems={navItems} releaseTo="/release" statusLines={statusLines}>
      {body()}
    </AppShell>
  );
}

function EmptyPrompt({ to, text, t }: { to: string; text: string; t: { accent: string; border: string } }) {
  return (
    <div style={{ marginBottom: 12, padding: '12px 14px', border: `1.5px dashed ${t.border}`, borderRadius: '3px 10px 3px 10px / 10px 3px 10px 3px' }}>
      <Link to={to} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.accent, textDecoration: 'none' }}>
        {text}
      </Link>
    </div>
  );
}
