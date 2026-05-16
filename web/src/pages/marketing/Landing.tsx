import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { get } from '../../lib/api';
import { useTheme, useTweaks } from '../../lib/theme';
import { SketchCard, InkButton } from '../../components/ui';
import { AegisLockup, AegisMascot } from '../../components/brand';
import { IconHeartbeat, IconPlane, IconCheck } from '../../components/icons';
import { MortalityRow } from '../../components/animations';

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
    sub: 'Self-hosted on your hardware',
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

  const badgeSvgProps = { width: 80, height: 68, viewBox: '0 0 80 68', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' };

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
            <svg {...badgeSvgProps}>
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
                const r = deg * Math.PI / 180;
                const r1 = 10, r2 = 17;
                return (
                  <line key={i} x1={40 + Math.cos(r) * r1} y1={10 + Math.sin(r) * r1} x2={40 + Math.cos(r) * r2} y2={10 + Math.sin(r) * r2} stroke={t.accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
                );
              })}
              <circle cx="40" cy="10" r="6" stroke={t.accent} strokeWidth="2" fill="none" />
              <circle cx="40" cy="10" r="2.5" stroke={t.accent} strokeWidth="1.5" fill="none" opacity="0.6" />
              <line x1="40" y1="16" x2="40" y2="34" stroke={t.accent} strokeWidth="2.2" strokeLinecap="round" />
              <line x1="40" y1="24" x2="44" y2="24" stroke={t.accent} strokeWidth="1.8" strokeLinecap="round" />
              <line x1="40" y1="29" x2="43" y2="29" stroke={t.accent} strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="40" cy="44" r="7" stroke={t.ink} strokeWidth="2" fill="none" />
              <line x1="40" y1="51" x2="40" y2="62" stroke={t.ink} strokeWidth="2" strokeLinecap="round" />
              <path d="M40 55 Q42 48 40 37" stroke={t.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <path d="M40 55 Q30 52 24 56" stroke={t.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <line x1="40" y1="62" x2="34" y2="68" stroke={t.ink} strokeWidth="2" strokeLinecap="round" />
              <line x1="40" y1="62" x2="46" y2="68" stroke={t.ink} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span style={{ fontFamily: "'Caveat',cursive", fontSize: 16, fontWeight: 700, color: t.ink, textAlign: 'center', lineHeight: 1.2 }}>No passwords stored</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: t.muted, letterSpacing: '0.06em', textAlign: 'center', textTransform: 'uppercase' }}>Keys belong to you</span>
          </div>

          {/* Badge 2: Self-hostable */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: t.surface, border: `2px solid ${t.border}`, borderRadius: '3px 10px 3px 10px / 10px 3px 10px 3px', padding: '18px 22px', minWidth: 160, maxWidth: 190, transform: 'rotate(0.4deg)' }}>
            <svg {...badgeSvgProps}>
              <defs>
                <filter id="wc_b2" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" />
                </filter>
              </defs>
              <ellipse cx="40" cy="56" rx="28" ry="10" fill={t.accent} opacity="0.12" filter="url(#wc_b2)" />
              <rect x="12" y="38" width="56" height="14" rx="2" stroke={t.ink} strokeWidth="2" fill="none" />
              <rect x="12" y="52" width="56" height="10" rx="2" stroke={t.ink} strokeWidth="1.5" fill="none" />
              <circle cx="18" cy="45" r="2.5" fill={t.accent} opacity="0.8" />
              <circle cx="18" cy="57" r="2.5" fill={t.accent} opacity="0.5" />
              <line x1="25" y1="45" x2="46" y2="45" stroke={t.ink} strokeWidth="1.4" opacity="0.4" />
              <line x1="25" y1="57" x2="46" y2="57" stroke={t.ink} strokeWidth="1.4" opacity="0.4" />
              <circle cx="40" cy="11" r="7" stroke={t.ink} strokeWidth="2" fill="none" />
              <line x1="40" y1="18" x2="40" y2="34" stroke={t.ink} strokeWidth="2" strokeLinecap="round" />
              <path d="M40 24 Q30 20 26 24" stroke={t.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <path d="M40 24 Q50 20 54 24" stroke={t.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <line x1="40" y1="34" x2="34" y2="38" stroke={t.ink} strokeWidth="2" strokeLinecap="round" />
              <line x1="40" y1="34" x2="46" y2="38" stroke={t.ink} strokeWidth="2" strokeLinecap="round" />
              <line x1="54" y1="36" x2="54" y2="24" stroke={t.ink} strokeWidth="1.5" strokeLinecap="round" />
              <path d="M54 24 L62 27 L54 30 Z" stroke={t.ink} strokeWidth="1.3" fill={t.accent} opacity="0.7" />
            </svg>
            <span style={{ fontFamily: "'Caveat',cursive", fontSize: 16, fontWeight: 700, color: t.ink, textAlign: 'center', lineHeight: 1.2 }}>Self-hostable</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: t.muted, letterSpacing: '0.06em', textAlign: 'center', textTransform: 'uppercase' }}>Your hardware, your rules</span>
          </div>

          {/* Badge 3: Open source core */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: t.surface, border: `2px solid ${t.border}`, borderRadius: '3px 10px 3px 10px / 10px 3px 10px 3px', padding: '18px 22px', minWidth: 160, maxWidth: 190, transform: 'rotate(-0.3deg)' }}>
            <svg {...badgeSvgProps}>
              <rect x="18" y="38" width="48" height="26" rx="2" stroke={t.ink} strokeWidth="2" fill="none" />
              <path d="M18 38 L14 22 L66 18 L66 38" stroke={t.ink} strokeWidth="2" fill="none" strokeLinejoin="round" />
              <line x1="14" y1="22" x2="66" y2="18" stroke={t.ink} strokeWidth="2" strokeLinecap="round" />
              <line x1="30" y1="36" x2="22" y2="24" stroke={t.accent} strokeWidth="1.3" opacity="0.55" strokeLinecap="round" />
              <line x1="42" y1="35" x2="40" y2="20" stroke={t.accent} strokeWidth="1.3" opacity="0.65" strokeLinecap="round" />
              <line x1="54" y1="36" x2="60" y2="24" stroke={t.accent} strokeWidth="1.3" opacity="0.55" strokeLinecap="round" />
              <text x="24" y="52" fontFamily="monospace" fontSize="7" fill={t.accent} opacity="0.75">{'{ }'}</text>
              <text x="42" y="58" fontFamily="monospace" fontSize="6" fill={t.ink} opacity="0.4">{'<>'}</text>
              <circle cx="42" cy="10" r="7" stroke={t.ink} strokeWidth="2" fill="none" />
              <path d="M42 17 Q42 24 38 30" stroke={t.ink} strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M42 22 Q50 22 56 26" stroke={t.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <path d="M42 22 Q34 22 28 26" stroke={t.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <line x1="38" y1="30" x2="33" y2="40" stroke={t.ink} strokeWidth="2" strokeLinecap="round" />
              <line x1="38" y1="30" x2="42" y2="40" stroke={t.ink} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span style={{ fontFamily: "'Caveat',cursive", fontSize: 16, fontWeight: 700, color: t.ink, textAlign: 'center', lineHeight: 1.2 }}>Open source core</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: t.muted, letterSpacing: '0.06em', textAlign: 'center', textTransform: 'uppercase' }}>Read every line</span>
          </div>
        </div>
      </section>

      {/* ── MORTALITY SCENES ── */}
      <MortalityRow />

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: '80px 24px', maxWidth: 960, margin: '0 auto' }}>
        <h2 style={{ fontFamily: "'Caveat',cursive", fontSize: 48, fontWeight: 700, textAlign: 'center', margin: '0 0 12px' }}>How it works</h2>
        <p style={{ textAlign: 'center', fontSize: 12, color: t.muted, marginBottom: 48, letterSpacing: '0.06em' }}>THREE STEPS AND YOU'RE COVERED</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {[
            { n: '01', title: 'Enter your info', desc: 'Add account names, asset descriptions, and executor instructions — no passwords, just the metadata your people need.', tilt: -0.6 },
            { n: '02', title: 'Set your switch', desc: 'Choose Heartbeat Mode (check in every N days) or Trip Mode (trigger after a set date). Configure your release cascade.', tilt: 0.5 },
            { n: '03', title: 'Live your life', desc: "Aegis watches quietly. Check in regularly. If you don't — your trusted contacts receive a secure, encrypted claim link.", tilt: -0.4 },
          ].map(step => (
            <SketchCard key={step.n} tilt={step.tilt} style={{ padding: '24px 22px' }}>
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

        {/* Alpha disclaimer (retained from Phase 5 legal hardening) */}
        <p style={{ marginTop: 40, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, textAlign: 'center', lineHeight: 1.7, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', padding: '12px 16px', border: `1.5px dashed ${t.border}`, borderRadius: '3px 10px 3px 10px / 10px 3px 10px 3px' }}>
          Alpha software. Not a legal instrument. Does not replace a will, trust, or attorney. Security has not been independently audited. Use at your own risk.
        </p>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: `2px dashed ${t.border}`, padding: '24px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <AegisMascot height={36} color={t.muted} />
        </div>
        <div style={{ fontSize: 11, color: t.muted, letterSpacing: '0.08em' }}>
          AEGIS IS NOT A WILL, TRUST, OR LEGAL DOCUMENT. IT IS A METADATA DELIVERY SYSTEM.
        </div>
        <div style={{ fontSize: 11, color: t.muted, marginTop: 6, opacity: 0.6 }}>© {new Date().getFullYear()} Aegis DMS — Open-source core under AGPL-3.0. Open source with love and mild existential dread.</div>
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
