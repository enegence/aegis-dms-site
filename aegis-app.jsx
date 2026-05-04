
// ── LANDING PAGE ──
function LandingPage({ setPage }) {
  const t = window.__aegisTheme;

  return (
    <div style={{ fontFamily: "'JetBrains Mono',monospace", color: t.ink }}>

      {/* ── HERO ── */}
      <section style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        padding: '100px 24px 80px', textAlign: 'center', position: 'relative',
      }}>
        {/* Decorative corner doodles */}
        {(window.__aegisTweaks || {}).showDoodles !== false && <>
          <svg style={{ position: 'absolute', top: 24, left: 24, opacity: 0.15 }} width="80" height="80" viewBox="0 0 80 80" fill="none">
            <path d="M4 76 L4 4 L76 4" stroke={t.ink} strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <circle cx="4" cy="4" r="4" fill={t.ink}/>
          </svg>
          <svg style={{ position: 'absolute', bottom: 24, right: 24, opacity: 0.15, transform: 'rotate(180deg)' }} width="80" height="80" viewBox="0 0 80 80" fill="none">
            <path d="M4 76 L4 4 L76 4" stroke={t.ink} strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <circle cx="4" cy="4" r="4" fill={t.ink}/>
          </svg>
        </>}

        <div style={{ marginBottom: 32 }}>
          <AegisLockup size="lg" color={t.ink} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 28, width: '100%', maxWidth: 900, textAlign: 'center' }}>
          <h1 style={{
            fontFamily: "'Caveat',cursive", fontSize: 36 * ((window.__aegisTweaks || {}).headingScale || 1),
            fontWeight: 700, color: t.ink, lineHeight: 2.0,
            maxWidth: 900, margin: 0, textAlign: 'center',
          }}>
            What happens after you're gone?
          </h1>

          <p style={{
            fontSize: 14, color: t.muted, maxWidth: 520, lineHeight: 1.8,
            margin: '0 auto', letterSpacing: '0.04em', textAlign: 'center',
          }}>
            Aegis is a privacy-first digital legacy release system.<br />
            Your estate info, delivered to trusted people — automatically.<br />
            If you don't check in, it knows.
          </p>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            <InkButton size="lg" onClick={() => setPage('onboarding')}>Set Up Your Switch →</InkButton>
            <InkButton size="lg" variant="ghost" onClick={() => setPage('dashboard')}>See the Dashboard</InkButton>
          </div>
        </div>

        {/* Bespoke illustrated trust badges */}
        <div style={{ marginTop: 48, display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>

          {/* Badge 1: No passwords stored */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            background: t.surface, border: `2px solid ${t.border}`,
            borderRadius: '3px 10px 3px 10px / 10px 3px 10px 3px',
            padding: '18px 22px', minWidth: 160, maxWidth: 190,
            transform: 'rotate(-0.6deg)',
          }}>
            {/* Stick figure holding key aloft — Link found a sword pose */}
            <svg width="80" height="68" viewBox="0 0 80 68" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Radiant lines from key — triumph glow */}
              {[0,45,90,135,180,225,270,315].map((deg, i) => {
                const r = deg * Math.PI / 180;
                const r1 = 10, r2 = 17;
                return (
                  <line key={i}
                    x1={40 + Math.cos(r)*r1} y1={10 + Math.sin(r)*r1}
                    x2={40 + Math.cos(r)*r2} y2={10 + Math.sin(r)*r2}
                    stroke={t.accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
                );
              })}
              {/* Key held high — bow at top, shaft pointing down */}
              <circle cx="40" cy="10" r="6" stroke={t.accent} strokeWidth="2" fill="none"/>
              <circle cx="40" cy="10" r="2.5" stroke={t.accent} strokeWidth="1.5" fill="none" opacity="0.6"/>
              <line x1="40" y1="16" x2="40" y2="34" stroke={t.accent} strokeWidth="2.2" strokeLinecap="round"/>
              <line x1="40" y1="24" x2="44" y2="24" stroke={t.accent} strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="40" y1="29" x2="43" y2="29" stroke={t.accent} strokeWidth="1.5" strokeLinecap="round"/>
              {/* Stick figure — both arms raised in triumph */}
              <circle cx="40" cy="44" r="7" stroke={t.ink} strokeWidth="2" fill="none"/>
              <line x1="40" y1="51" x2="40" y2="62" stroke={t.ink} strokeWidth="2" strokeLinecap="round"/>
              {/* Right arm up holding key */}
              <path d="M40 55 Q42 48 40 37" stroke={t.ink} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
              {/* Left arm out for balance */}
              <path d="M40 55 Q30 52 24 56" stroke={t.ink} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
              {/* Legs — triumphant wide stance */}
              <line x1="40" y1="62" x2="34" y2="68" stroke={t.ink} strokeWidth="2" strokeLinecap="round"/>
              <line x1="40" y1="62" x2="46" y2="68" stroke={t.ink} strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontFamily: "'Caveat',cursive", fontSize: 16, fontWeight: 700, color: t.ink, textAlign: 'center', lineHeight: 1.2 }}>No passwords stored</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: t.muted, letterSpacing: '0.06em', textAlign: 'center', textTransform: 'uppercase' }}>Keys belong to you</span>
          </div>

          {/* Badge 2: Self-hostable */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            background: t.surface, border: `2px solid ${t.border}`,
            borderRadius: '3px 10px 3px 10px / 10px 3px 10px 3px',
            padding: '18px 22px', minWidth: 160, maxWidth: 190,
            transform: 'rotate(0.4deg)',
          }}>
            {/* Stick figure standing on a server/house */}
            <svg width="80" height="68" viewBox="0 0 80 68" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="wc_b2" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4"/>
                </filter>
              </defs>
              <ellipse cx="40" cy="56" rx="28" ry="10" fill={t.accent} opacity="0.12" filter="url(#wc_b2)"/>
              {/* server box */}
              <rect x="12" y="38" width="56" height="14" rx="2" stroke={t.ink} strokeWidth="2" fill="none"/>
              <rect x="12" y="52" width="56" height="10" rx="2" stroke={t.ink} strokeWidth="1.5" fill="none"/>
              <circle cx="18" cy="45" r="2.5" fill={t.accent} opacity="0.8"/>
              <circle cx="18" cy="57" r="2.5" fill={t.accent} opacity="0.5"/>
              <line x1="25" y1="45" x2="46" y2="45" stroke={t.ink} strokeWidth="1.4" opacity="0.4"/>
              <line x1="25" y1="57" x2="46" y2="57" stroke={t.ink} strokeWidth="1.4" opacity="0.4"/>
              {/* stick figure standing on server */}
              <circle cx="40" cy="11" r="7" stroke={t.ink} strokeWidth="2" fill="none"/>
              <line x1="40" y1="18" x2="40" y2="34" stroke={t.ink} strokeWidth="2" strokeLinecap="round"/>
              <path d="M40 24 Q30 20 26 24" stroke={t.ink} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
              <path d="M40 24 Q50 20 54 24" stroke={t.ink} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
              <line x1="40" y1="34" x2="34" y2="38" stroke={t.ink} strokeWidth="2" strokeLinecap="round"/>
              <line x1="40" y1="34" x2="46" y2="38" stroke={t.ink} strokeWidth="2" strokeLinecap="round"/>
              {/* little flag */}
              <line x1="54" y1="36" x2="54" y2="24" stroke={t.ink} strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M54 24 L62 27 L54 30 Z" stroke={t.ink} strokeWidth="1.3" fill={t.accent} opacity="0.7"/>
            </svg>
            <span style={{ fontFamily: "'Caveat',cursive", fontSize: 16, fontWeight: 700, color: t.ink, textAlign: 'center', lineHeight: 1.2 }}>Self-hostable</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: t.muted, letterSpacing: '0.06em', textAlign: 'center', textTransform: 'uppercase' }}>Your hardware, your rules</span>
          </div>

          {/* Badge 3: Open source core */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            background: t.surface, border: `2px solid ${t.border}`,
            borderRadius: '3px 10px 3px 10px / 10px 3px 10px 3px',
            padding: '18px 22px', minWidth: 160, maxWidth: 190,
            transform: 'rotate(-0.3deg)',
          }}>
            {/* Open box with code visible inside — "look inside" */}
            <svg width="80" height="68" viewBox="0 0 80 68" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Open box / chest — lid propped open */}
              {/* Box body */}
              <rect x="18" y="38" width="48" height="26" rx="2"
                stroke={t.ink} strokeWidth="2" fill="none"/>
              {/* Lid — propped open at angle */}
              <path d="M18 38 L14 22 L66 18 L66 38"
                stroke={t.ink} strokeWidth="2" fill="none" strokeLinejoin="round"/>
              {/* Lid top edge */}
              <line x1="14" y1="22" x2="66" y2="18" stroke={t.ink} strokeWidth="2" strokeLinecap="round"/>
              {/* Light beams spilling out from open box */}
              <line x1="30" y1="36" x2="22" y2="24" stroke={t.accent} strokeWidth="1.3" opacity="0.55" strokeLinecap="round"/>
              <line x1="42" y1="35" x2="40" y2="20" stroke={t.accent} strokeWidth="1.3" opacity="0.65" strokeLinecap="round"/>
              <line x1="54" y1="36" x2="60" y2="24" stroke={t.accent} strokeWidth="1.3" opacity="0.55" strokeLinecap="round"/>
              {/* Code chars inside the box */}
              <text x="24" y="52" fontFamily="monospace" fontSize="7" fill={t.accent} opacity="0.75">{"{ }"}</text>
              <text x="42" y="58" fontFamily="monospace" fontSize="6" fill={t.ink} opacity="0.4">{"<>"}</text>
              {/* Stick figure peering over the lid */}
              <circle cx="42" cy="10" r="7" stroke={t.ink} strokeWidth="2" fill="none"/>
              {/* Leaning forward — torso angled */}
              <path d="M42 17 Q42 24 38 30" stroke={t.ink} strokeWidth="2" strokeLinecap="round" fill="none"/>
              {/* Arms — both on lid edge, peering in */}
              <path d="M42 22 Q50 22 56 26" stroke={t.ink} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
              <path d="M42 22 Q34 22 28 26" stroke={t.ink} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
              {/* Legs behind */}
              <line x1="38" y1="30" x2="33" y2="40" stroke={t.ink} strokeWidth="2" strokeLinecap="round"/>
              <line x1="38" y1="30" x2="42" y2="40" stroke={t.ink} strokeWidth="2" strokeLinecap="round"/>
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
              <IconHeartbeat size={32} color={t.accent}/>
              Heartbeat Mode
            </div>
            <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.8, marginBottom: 14 }}>Set a recurring check-in interval — every 7, 14, or 30 days. Miss your window and Aegis begins the contact cascade automatically.</div>
            <div style={{ fontSize: 11, color: t.accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Best for: everyday coverage</div>
          </SketchCard>
          <SketchCard tilt={0.5} style={{ padding: '28px 26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'Caveat',cursive", fontSize: 30, marginBottom: 10 }}>
              <IconPlane size={32} color={t.accent}/>
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
          {[
            { name: 'Open Source', price: 'Free', sub: 'Self-hosted on your hardware', items: ['Docker + Compose', 'Heartbeat + Trip modes', 'S3-compatible dead drop', 'Local notifications'], cta: 'Get the repo', tilt: -0.5, ghost: true },
            { name: 'Aegis Relay', price: '$4/mo', sub: 'Cloud monitoring layer', items: ['Everything in OSS', 'Relay monitors your server', 'Cloud notification fallback', 'Executor claim portal'], cta: 'Start free trial', tilt: 0.4, ghost: false, badge: 'POPULAR' },
            { name: 'Aegis Hosted', price: '$9/mo', sub: 'Zero-setup SaaS', items: ['No Docker required', 'Encrypted cloud storage', 'Helper Pack included', 'Priority support'], cta: 'Get started', tilt: -0.3, ghost: true },
          ].map(plan => (
            <SketchCard key={plan.name} tilt={plan.tilt} style={{ padding: '24px 22px', position: 'relative' }}>
              {plan.badge && (
                <div style={{
                  position: 'absolute', top: -12, right: 18,
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
                  background: t.ink, color: t.bg, borderRadius: 99, padding: '4px 10px',
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                }}>{plan.badge}</div>
              )}
              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 28, fontWeight: 700, color: t.ink }}>{plan.name}</div>
              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 42, fontWeight: 700, color: t.accent, lineHeight: 1, margin: '6px 0 4px' }}>{plan.price}</div>
              <div style={{ fontSize: 11, color: t.muted, letterSpacing: '0.06em', marginBottom: 16 }}>{plan.sub}</div>
              {plan.items.map(item => (
                <div key={item} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: t.ink, marginBottom: 6 }}>
                  <IconCheck size={14} color={t.accent}/>
                  {item}
                </div>
              ))}
              <div style={{ marginTop: 20 }}>
                <InkButton variant={plan.ghost ? 'ghost' : 'primary'} size="sm" onClick={() => setPage('onboarding')}>{plan.cta}</InkButton>
              </div>
            </SketchCard>
          ))}
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
        <div style={{ fontSize: 11, color: t.muted, marginTop: 6, opacity: 0.6 }}>© 2026 Aegis DMS — Open source with love and mild existential dread</div>
      </footer>
    </div>
  );
}

// ── ONBOARDING ──
function OnboardingPage({ setPage }) {
  const t = window.__aegisTheme;
  const [step, setStep] = React.useState(1);
  const [deployMode, setDeployMode] = React.useState('relay');
  const [triggerMode, setTriggerMode] = React.useState('heartbeat');
  const [interval, setInterval] = React.useState(14);
  const [contactName, setContactName] = React.useState('');
  const [contactEmail, setContactEmail] = React.useState('');
  const TOTAL = 4;

  const DEPLOY_MODES = [
    { key: 'selfhosted', icon: <IconSelfHost size={22} color="currentColor"/>, label: 'Self-Hosted', desc: 'Docker on your own hardware. Free forever.' },
    { key: 'relay',      icon: <IconCloud size={22} color="currentColor"/>,    label: 'Self-Hosted + Relay', desc: '$4/mo cloud monitoring. Recommended.' },
    { key: 'hosted',     icon: <IconDeployment size={22} color="currentColor"/>, label: 'Fully Hosted', desc: '$9/mo — no setup required.' },
  ];
  const TRIGGER_MODES = [
    { key: 'heartbeat', icon: <IconHeartbeat size={22} color="currentColor"/>, label: 'Heartbeat Mode', desc: 'Check in periodically to stay the hand.' },
    { key: 'trip',      icon: <IconPlane size={22} color="currentColor"/>,     label: 'Trip Mode', desc: 'Arm for a specific trip and return date.' },
  ];

  function StepDots() {
    return (
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 32 }}>
        {Array.from({ length: TOTAL }).map((_, i) => (
          <div key={i} style={{
            width: i + 1 === step ? 28 : 10, height: 10,
            borderRadius: 99,
            background: i + 1 <= step ? t.ink : t.border,
            transition: 'all 0.2s',
          }} />
        ))}
      </div>
    );
  }

  const modeBtn = (m, active, onClick) => (
    <button key={m.key} onClick={onClick} style={{
      fontFamily: "'Caveat',cursive", fontSize: 20, fontWeight: 700,
      padding: '14px 18px', textAlign: 'left', cursor: 'pointer',
      background: active ? t.ink : 'transparent',
      color: active ? t.bg : t.ink,
      border: `2px solid ${active ? t.ink : t.border}`,
      borderRadius: '3px 8px 3px 8px / 8px 3px 8px 3px',
      transition: 'all 0.1s',
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <span style={{ marginTop: 2, opacity: active ? 1 : 0.6, flexShrink: 0 }}>{m.icon}</span>
      <div>
        {m.label}
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginTop: 3, opacity: 0.7, fontWeight: 400 }}>{m.desc}</div>
      </div>
    </button>
  );

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', background: t.bg,
    }}>
      <div style={{ marginBottom: 28 }}>
        <AegisLockup size="sm" color={t.ink} />
      </div>
      <StepDots />
      <div style={{ width: '100%', maxWidth: 540 }}>

        {step === 1 && (
          <SketchCard>
            <SectionTitle sub={`STEP 1 OF ${TOTAL}`}>Where will Aegis live?</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {DEPLOY_MODES.map(m => modeBtn(m, deployMode === m.key, () => setDeployMode(m.key)))}
            </div>
            <InkButton onClick={() => setStep(2)}>Next →</InkButton>
          </SketchCard>
        )}

        {step === 2 && (
          <SketchCard>
            <SectionTitle sub={`STEP 2 OF ${TOTAL}`}>How should the switch trigger?</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {TRIGGER_MODES.map(m => modeBtn(m, triggerMode === m.key, () => setTriggerMode(m.key)))}
            </div>
            {triggerMode === 'heartbeat' && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Check-in every</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="range" min={7} max={60} value={interval} onChange={e => setInterval(+e.target.value)} style={{ flex: 1, accentColor: t.accent }} />
                  <span style={{ fontFamily: "'Caveat',cursive", fontSize: 28, fontWeight: 700, color: t.accent, minWidth: 80 }}>{interval} days</span>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <InkButton variant="ghost" size="sm" onClick={() => setStep(1)}>← Back</InkButton>
              <InkButton onClick={() => setStep(3)}>Next →</InkButton>
            </div>
          </SketchCard>
        )}

        {step === 3 && (
          <SketchCard>
            <SectionTitle sub={`STEP 3 OF ${TOTAL}`}>Who should be notified first?</SectionTitle>
            <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, lineHeight: 1.7, marginBottom: 20 }}>
              Add your primary contact. They'll receive a secure, encrypted claim link if you don't check in.
            </p>
            {[
              { placeholder: 'Full name', val: contactName, set: setContactName },
              { placeholder: 'Email address', val: contactEmail, set: setContactEmail },
            ].map((f, i) => (
              <input key={i} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                style={{ width: '100%', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, padding: '10px 12px', marginBottom: 10, background: t.bg, border: `1.5px solid ${t.border}`, borderRadius: 4, color: t.ink, boxSizing: 'border-box', outline: 'none' }} />
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <InkButton variant="ghost" size="sm" onClick={() => setStep(2)}>← Back</InkButton>
              <InkButton onClick={() => setStep(4)}>Next →</InkButton>
            </div>
          </SketchCard>
        )}

        {step === 4 && (
          <SketchCard style={{ textAlign: 'center', padding: '40px 32px' }}>
            <div style={{ marginBottom: 16 }}>
              <AegisMascot height={64} color={t.ink} />
            </div>
            <h2 style={{ fontFamily: "'Caveat',cursive", fontSize: 42, fontWeight: 700, color: t.ink, margin: '0 0 12px' }}>You're all set.</h2>
            <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, lineHeight: 1.8, marginBottom: 28 }}>
              Aegis is armed.<br />
              {contactName ? `${contactName} will be notified if you miss a check-in.` : 'Your contact will be notified if you miss a check-in.'}<br />
              Check in from the dashboard to keep the clock reset.
            </p>
            <InkButton size="lg" onClick={() => setPage('dashboard')}>Go to Dashboard →</InkButton>
          </SketchCard>
        )}
      </div>
    </div>
  );
}

// ── APP SHELL (inner pages with nav) ──
const NAV_ITEMS = [
  { key: 'dashboard',  label: 'Dashboard',      Icon: IconDashboard  },
  { key: 'legacy',     label: 'Legacy Packet',  Icon: IconLegacy     },
  { key: 'contacts',   label: 'Contacts',       Icon: IconContacts   },
  { key: 'trigger',    label: 'Trigger',        Icon: IconTrigger    },
  { key: 'deployment', label: 'Deployment',     Icon: IconDeployment },
];

function AppShell({ page, setPage, children }) {
  const t = window.__aegisTheme;
  const tw = window.__aegisTweaks || {};
  const sidebarWidth = tw.sidebarWidth || 220;
  const logoSize = tw.logoSize || 'sm';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: t.bg, color: t.ink }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarWidth, flexShrink: 0, background: t.surface,
        borderRight: `2px solid ${t.border}`,
        display: 'flex', flexDirection: 'column',
        padding: '24px 0',
        transition: 'width 0.2s',
      }}>
        <div style={{ padding: '0 20px 28px', borderBottom: `1.5px dashed ${t.border}` }}>
          <div onClick={() => setPage('landing')} style={{ cursor: 'pointer' }}>
            <AegisLockup size={logoSize} color={t.ink} />
          </div>
        </div>
        <nav style={{ padding: '16px 12px', flex: 1 }}>
          {NAV_ITEMS.map(item => {
            const active = page === item.key;
            return (
              <button key={item.key} onClick={() => setPage(item.key)} style={{
                width: '100%', textAlign: 'left',
                fontFamily: "'Caveat',cursive", fontSize: 20, fontWeight: active ? 700 : 400,
                padding: '9px 12px', marginBottom: 4,
                background: active ? t.ink : 'transparent',
                color: active ? t.bg : t.ink,
                border: `2px solid ${active ? t.ink : 'transparent'}`,
                borderRadius: '3px 8px 3px 8px / 8px 3px 8px 3px',
                cursor: 'pointer',
                display: 'flex', gap: 10, alignItems: 'center',
                transform: active ? 'rotate(-0.4deg)' : 'none',
                transition: 'all 0.1s',
              }}>
                <item.Icon size={18} color={active ? t.bg : t.ink} style={{ opacity: active ? 1 : 0.65 }}/>
                {item.label}
              </button>
            );
          })}
        </nav>
        {/* Release mode button */}
        <div style={{ padding: '0 12px 12px' }}>
          <button onClick={() => setPage('release')} style={{
            width: '100%', fontFamily: "'Caveat',cursive", fontSize: 16, fontWeight: 700,
            padding: '10px 12px', background: page === 'release' ? t.danger : 'transparent',
            color: page === 'release' ? '#fff' : t.danger,
            border: `2px solid ${t.danger}`,
            borderRadius: '3px 8px 3px 8px / 8px 3px 8px 3px',
            cursor: 'pointer', transition: 'all 0.1s',
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <IconRelease size={17} color={page === 'release' ? '#fff' : t.danger}/>
            Release Mode
          </button>
        </div>
        <div style={{ padding: '12px 20px 0', borderTop: `1.5px dashed ${t.border}` }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: t.muted, letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1.6 }}>
            Status: Armed<br />Mode: Heartbeat<br />Dead drop: Synced ✓
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: '36px 40px', maxWidth: 900, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}

// ── ROOT APP ──
function AegisApp() {
  const [page, setPage] = React.useState('landing');

  const innerPages = ['dashboard', 'legacy', 'contacts', 'trigger', 'release', 'deployment'];
  const isInner = innerPages.includes(page);

  const pageMap = {
    dashboard: <DashboardPage setPage={setPage} />,
    legacy: <LegacyPage />,
    contacts: <ContactsPage />,
    trigger: <TriggerPage />,
    release: <ReleasePage setPage={setPage} />,
    deployment: <DeploymentPage />,
  };

  if (page === 'landing') return <LandingPage setPage={setPage} />;
  if (page === 'onboarding') return <OnboardingPage setPage={setPage} />;
  if (isInner) return (
    <AppShell page={page} setPage={setPage}>
      {pageMap[page]}
    </AppShell>
  );
  return <LandingPage setPage={setPage} />;
}

Object.assign(window, { AegisApp, LandingPage, OnboardingPage, AppShell });
