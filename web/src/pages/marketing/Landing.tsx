import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { get } from '../../lib/api';
import { useTheme, useTweaks } from '../../lib/theme';
import { SketchCard, InkButton } from '../../components/ui';
import { AegisLockup, AegisMascot } from '../../components/brand';
import { IconHeartbeat, IconPlane, IconCheck } from '../../components/icons';

const GITHUB_URL = 'https://github.com/your-org/aegis';

interface PricingPlan {
  id: string;
  name: string;
  description?: string;
  price: number | null;
  pricingUrl?: string;
  features: string[];
  highlighted?: boolean;
}

// Original 3-tier IA. The Open Source tier is a product surface (free, AGPL),
// not a Stripe plan, so it is static and correctly absent from /api/pricing.
// Relay + Hosted are overlaid with live /api/pricing values by id.
const BASE_PLANS = [
  {
    id: 'oss',
    name: 'Open Source',
    sub: 'Self-hosted · open-source core under AGPL-3.0',
    items: ['Docker + Compose', 'Heartbeat + Trip modes', 'S3-compatible dead drop', 'Local notifications'],
    cta: 'Get the repo',
    tilt: -0.5,
    ghost: true,
    badge: undefined as string | undefined,
    staticPrice: 'Free',
    href: GITHUB_URL,
    external: true,
  },
  {
    id: 'relay',
    name: 'Aegis Relay',
    sub: 'Cloud monitoring layer',
    items: ['Everything in OSS', 'Relay monitors your server', 'Cloud notification fallback', 'Executor claim portal'],
    cta: 'Start free trial',
    tilt: 0.4,
    ghost: false,
    badge: 'POPULAR' as string | undefined,
    staticPrice: null as string | null,
    href: '/register',
    external: false,
  },
  {
    id: 'hosted',
    name: 'Aegis Hosted',
    sub: 'Zero-setup SaaS',
    items: ['No Docker required', 'Encrypted cloud storage', 'Helper Pack included', 'Priority support'],
    cta: 'Get started',
    tilt: -0.3,
    ghost: true,
    badge: undefined as string | undefined,
    staticPrice: null as string | null,
    href: '/register',
    external: false,
  },
];

// Renders a transparent-PNG line drawing as a theme-colored shape: the PNG's
// alpha is used as a CSS mask and painted with the current theme ink color,
// so the art stays visible on every theme and auto-centers in a fixed box.
function MaskArt({ src, color, style }: { src: string; color: string; style?: CSSProperties }) {
  return (
    <div
      role="img"
      style={{
        backgroundColor: color,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        ...style,
      }}
    />
  );
}

export default function Landing() {
  const t = useTheme();
  const [tw] = useTweaks();
  const navigate = useNavigate();
  const showDoodles = tw.showDoodles !== false;
  const headingScale = (tw.headingScale as number) || 1;
  const [livePlans, setLivePlans] = useState<Record<string, PricingPlan>>({});

  useEffect(() => {
    get<{ plans: PricingPlan[] }>('/api/pricing')
      .then(r => {
        const map: Record<string, PricingPlan> = {};
        for (const p of r.plans) map[p.id] = p;
        setLivePlans(map);
      })
      .catch(() => { /* non-critical: cards fall back to static copy */ });
  }, []);

  return (
    <div style={{ fontFamily: "'JetBrains Mono',monospace", color: t.ink, background: t.bg, minHeight: '100vh' }}>
      {/* ── HERO ── */}
      <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '100px 24px 80px', textAlign: 'center', position: 'relative' }}>
        {showDoodles && (
          <>
            <svg style={{ position: 'absolute', top: 24, left: 24, opacity: 0.15 }} width="80" height="80" viewBox="0 0 80 80" fill="none">
              <path d="M4 76 L4 4 L76 4" stroke={t.ink} strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <circle cx="4" cy="4" r="4" fill={t.ink} />
            </svg>
            <svg style={{ position: 'absolute', bottom: 24, right: 24, opacity: 0.15, transform: 'rotate(180deg)' }} width="80" height="80" viewBox="0 0 80 80" fill="none">
              <path d="M4 76 L4 4 L76 4" stroke={t.ink} strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <circle cx="4" cy="4" r="4" fill={t.ink} />
            </svg>
          </>
        )}

        <div style={{ marginBottom: 32 }}>
          <AegisLockup size="lg" color={t.ink} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 28, width: '100%', maxWidth: 900, textAlign: 'center' }}>
          <h1 style={{ fontFamily: "'Caveat',cursive", fontSize: 36 * headingScale, fontWeight: 700, color: t.ink, lineHeight: 2.0, maxWidth: 900, margin: 0, textAlign: 'center' }}>
            What happens after you're gone?
          </h1>

          <p style={{ fontSize: 14, color: t.muted, maxWidth: 520, lineHeight: 1.8, margin: '0 auto', letterSpacing: '0.04em', textAlign: 'center' }}>
            Aegis is a privacy-first digital legacy release system.<br />
            Your estate info, delivered to trusted people — automatically.<br />
            If you don't check in, it knows.
          </p>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            <InkButton size="lg" onClick={() => navigate('/register')}>Set Up Your Switch →</InkButton>
            <InkButton size="lg" variant="ghost" onClick={() => navigate('/login')}>See the Dashboard</InkButton>
          </div>
        </div>

        {/* Bespoke illustrated trust badges */}
        <div style={{ marginTop: 48, display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          {/* Badge 1: No passwords stored */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: t.surface, border: `2px solid ${t.border}`, borderRadius: '3px 10px 3px 10px / 10px 3px 10px 3px', padding: '18px 22px', minWidth: 160, maxWidth: 190, transform: 'rotate(-0.6deg)' }}>
            <MaskArt src="/illustrations/no-passwords.png" color={t.ink} style={{ width: 116, height: 100 }} />
            <span style={{ fontFamily: "'Caveat',cursive", fontSize: 16, fontWeight: 700, color: t.ink, textAlign: 'center', lineHeight: 1.2 }}>No passwords stored</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: t.muted, letterSpacing: '0.06em', textAlign: 'center', textTransform: 'uppercase' }}>Keys belong to you</span>
          </div>

          {/* Badge 2: Self-hostable */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: t.surface, border: `2px solid ${t.border}`, borderRadius: '3px 10px 3px 10px / 10px 3px 10px 3px', padding: '18px 22px', minWidth: 160, maxWidth: 190, transform: 'rotate(0.4deg)' }}>
            <MaskArt src="/illustrations/self-hostable.png" color={t.ink} style={{ width: 116, height: 100 }} />
            <span style={{ fontFamily: "'Caveat',cursive", fontSize: 16, fontWeight: 700, color: t.ink, textAlign: 'center', lineHeight: 1.2 }}>Self-hostable</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: t.muted, letterSpacing: '0.06em', textAlign: 'center', textTransform: 'uppercase' }}>Your hardware, your rules</span>
          </div>

          {/* Badge 3: Open source core */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: t.surface, border: `2px solid ${t.border}`, borderRadius: '3px 10px 3px 10px / 10px 3px 10px 3px', padding: '18px 22px', minWidth: 160, maxWidth: 190, transform: 'rotate(-0.3deg)' }}>
            <MaskArt src="/illustrations/open-source-core.png" color={t.ink} style={{ width: 116, height: 100 }} />
            <span style={{ fontFamily: "'Caveat',cursive", fontSize: 16, fontWeight: 700, color: t.ink, textAlign: 'center', lineHeight: 1.2 }}>Open source core</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: t.muted, letterSpacing: '0.06em', textAlign: 'center', textTransform: 'uppercase' }}>Read every line</span>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: '80px 24px', maxWidth: 960, margin: '0 auto' }}>
        <h2 style={{ fontFamily: "'Caveat',cursive", fontSize: 48, fontWeight: 700, textAlign: 'center', margin: '0 0 12px' }}>How it works</h2>
        <p style={{ textAlign: 'center', fontSize: 12, color: t.muted, marginBottom: 48, letterSpacing: '0.06em' }}>THREE STEPS AND YOU'RE COVERED</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {[
            {
              n: '01', title: 'Enter your info', tilt: -0.6,
              desc: 'Add account names, asset descriptions, and executor instructions — no passwords, just the metadata your people need.',
              art: <MaskArt src="/illustrations/enter-your-info.png" color={t.ink} style={{ width: '100%', height: 124, transform: 'scale(0.82)' }} />,
            },
            {
              n: '02', title: 'Set your switch', tilt: 0.5,
              desc: 'Choose Heartbeat Mode (check in every N days) or Trip Mode (trigger after a set date). Configure your release cascade.',
              art: <MaskArt src="/illustrations/set-your-switch.png" color={t.ink} style={{ width: '100%', height: 124, transform: 'scale(0.9)' }} />,
            },
            {
              n: '03', title: 'Live your life', tilt: -0.4,
              desc: "Aegis watches quietly. Check in regularly. If you don't — your trusted contacts receive a secure, encrypted claim link.",
              art: <MaskArt src="/illustrations/live-your-life.png" color={t.ink} style={{ width: '100%', height: 124 }} />,
            },
          ].map(step => (
            <SketchCard key={step.n} tilt={step.tilt} style={{ padding: '24px 22px' }}>
              <div style={{ marginBottom: 14 }}>{step.art}</div>
              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 56, fontWeight: 700, color: t.accent, lineHeight: 1, marginBottom: 8 }}>{step.n}</div>
              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 26, fontWeight: 700, color: t.ink, marginBottom: 10 }}>{step.title}</div>
              <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.8 }}>{step.desc}</div>
            </SketchCard>
          ))}
        </div>
      </section>

      {/* ── MODES ── */}
      <section style={{ padding: '60px 24px', maxWidth: 960, margin: '0 auto' }}>
        <h2 style={{ fontFamily: "'Caveat',cursive", fontSize: 48, fontWeight: 700, textAlign: 'center', margin: '0 0 12px' }}>Two trigger modes</h2>
        <p style={{ textAlign: 'center', fontSize: 12, color: t.muted, marginBottom: 40, letterSpacing: '0.06em' }}>FOR DIFFERENT KINDS OF "JUST IN CASE"</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          <SketchCard tilt={-0.4} style={{ padding: '28px 26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'Caveat',cursive", fontSize: 30, marginBottom: 10 }}>
              <IconHeartbeat size={32} color={t.accent} />
              Heartbeat Mode
            </div>
            <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.8, marginBottom: 14 }}>Set a recurring check-in interval — every 7, 14, or 30 days. Miss your window and Aegis begins the contact cascade automatically.</div>
            <div style={{ fontSize: 11, color: t.accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Best for: everyday coverage</div>
          </SketchCard>
          <SketchCard tilt={0.5} style={{ padding: '28px 26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'Caveat',cursive", fontSize: 30, marginBottom: 10 }}>
              <IconPlane size={32} color={t.accent} />
              Trip Mode
            </div>
            <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.8, marginBottom: 14 }}>Set a specific return date with a grace period. Perfect for international travel, remote expeditions, or any high-risk window.</div>
            <div style={{ fontSize: 11, color: t.accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Best for: specific trips</div>
          </SketchCard>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section style={{ padding: '60px 24px 80px', maxWidth: 960, margin: '0 auto' }}>
        <h2 style={{ fontFamily: "'Caveat',cursive", fontSize: 48, fontWeight: 700, textAlign: 'center', margin: '0 0 12px' }}>Pick your level of paranoia</h2>
        <p style={{ textAlign: 'center', fontSize: 12, color: t.muted, marginBottom: 40, letterSpacing: '0.06em' }}>ALL PLANS STORE NO PASSWORDS. EVER.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {BASE_PLANS.map(plan => {
            const live = livePlans[plan.id];
            const items = live?.features?.length ? live.features : plan.items;
            return (
              <SketchCard key={plan.id} tilt={plan.tilt} style={{ padding: '24px 22px', position: 'relative' }}>
                {plan.badge && (
                  <div style={{ position: 'absolute', top: -12, right: 18, fontFamily: "'JetBrains Mono',monospace", fontSize: 9, background: t.ink, color: t.bg, borderRadius: 99, padding: '4px 10px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{plan.badge}</div>
                )}
                <div style={{ fontFamily: "'Caveat',cursive", fontSize: 28, fontWeight: 700, color: t.ink }}>{plan.name}</div>
                <div style={{ fontFamily: "'Caveat',cursive", fontSize: 42, fontWeight: 700, color: t.accent, lineHeight: 1, margin: '6px 0 4px' }}>
                  {plan.staticPrice
                    ? plan.staticPrice
                    : live && live.price !== null && live.price !== undefined
                    ? `$${live.price}/mo`
                    : live?.pricingUrl
                    ? <a href={live.pricingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 16, color: t.accent }}>View current pricing →</a>
                    : <span style={{ fontSize: 16, color: t.muted }}>Pricing coming soon</span>}
                </div>
                <div style={{ fontSize: 11, color: t.muted, letterSpacing: '0.06em', marginBottom: 16 }}>{plan.sub}</div>
                {items.map(item => (
                  <div key={item} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: t.ink, marginBottom: 6 }}>
                    <IconCheck size={14} color={t.accent} />
                    {item}
                  </div>
                ))}
                <div style={{ marginTop: 20 }}>
                  {plan.external ? (
                    <a href={plan.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      <InkButton variant={plan.ghost ? 'ghost' : 'primary'} size="sm">{plan.cta}</InkButton>
                    </a>
                  ) : (
                    <InkButton variant={plan.ghost ? 'ghost' : 'primary'} size="sm" onClick={() => navigate(plan.href)}>{plan.cta}</InkButton>
                  )}
                </div>
              </SketchCard>
            );
          })}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: `2px dashed ${t.border}`, padding: '24px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <AegisMascot height={36} color={t.muted} />
        </div>
        <div style={{ fontSize: 11, color: t.muted, letterSpacing: '0.08em' }}>
          AEGIS IS NOT A WILL, TRUST, OR LEGAL DOCUMENT. IT IS A METADATA DELIVERY SYSTEM.
        </div>
        <div style={{ fontSize: 11, color: t.muted, marginTop: 6, opacity: 0.6 }}>© {new Date().getFullYear()} Aegis DMS — Built with love and mild existential dread.</div>
        <div style={{ fontSize: 11, color: t.muted, marginTop: 10 }}>
          {[
            ['Terms', '/terms'],
            ['Privacy', '/privacy'],
            ['Security', '/security'],
            ['Disclaimers', '/disclaimers'],
            ['Acceptable Use', '/acceptable-use'],
            ['Data Deletion', '/data-deletion'],
          ].map(([label, to], i) => (
            <span key={to}>
              {i > 0 && ' · '}
              <Link to={to} style={{ color: t.accent, textDecoration: 'none' }}>{label}</Link>
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}
