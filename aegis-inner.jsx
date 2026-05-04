
// ── INNER APP PAGES: Dashboard, Legacy, Contacts, Trigger, Release, Deployment ──

// ── SHARED INNER COMPONENTS ──
function StatPill({ label, value, accent }) {
  const t = window.__aegisTheme;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: t.surface, border: `2px solid ${t.border}`,
      borderRadius: '4px 10px 4px 10px / 10px 4px 10px 4px',
      padding: '10px 18px', minWidth: 90,
      transform: 'rotate(-0.3deg)',
    }}>
      <span style={{ fontFamily: "'Caveat',cursive", fontSize: 28, fontWeight: 700, color: accent || t.ink, lineHeight: 1 }}>{value}</span>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: t.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>{label}</span>
    </div>
  );
}

function SectionTitle({ children, sub }) {
  const t = window.__aegisTheme;
  const tw = window.__aegisTweaks || {};
  const scale = tw.headingScale || 1;
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontFamily: "'Caveat',cursive", fontSize: 34 * scale, fontWeight: 700, color: t.ink, margin: 0, lineHeight: 1 }}>{children}</h2>
      {sub && <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, margin: '4px 0 0', letterSpacing: '0.06em' }}>{sub}</p>}
    </div>
  );
}

function SketchCard({ children, style = {}, tilt = 0 }) {
  const t = window.__aegisTheme;
  const tw = window.__aegisTweaks || {};
  const cardStyle = tw.cardStyle || 'sketchy';
  const density = tw.density || 'comfortable';
  const tiltAmt = (tw.tiltAmount !== undefined ? tw.tiltAmount : 1) * tilt;
  const radii = {
    sketchy: '3px 10px 3px 10px / 10px 3px 10px 3px',
    sharp: '2px',
    pill: '16px',
  };
  const pad = density === 'compact' ? '12px 14px' : '20px 22px';
  return (
    <div style={{
      background: t.surface, border: `2px solid ${t.border}`,
      borderRadius: radii[cardStyle] || radii.sketchy,
      padding: pad,
      transform: tiltAmt ? `rotate(${tiltAmt}deg)` : 'none',
      transition: 'box-shadow 0.15s',
      ...style,
    }}>
      {children}
    </div>
  );
}

function InkButton({ children, onClick, variant = 'primary', size = 'md', style = {} }) {
  const t = window.__aegisTheme;
  const tw = window.__aegisTweaks || {};
  const [hov, setHov] = React.useState(false);
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isGhost = variant === 'ghost';
  const density = tw.density || 'comfortable';
  const btnShape = tw.buttonShape || 'sketchy';
  const sizes = {
    sm: { padding: density === 'compact' ? '4px 10px' : '6px 14px', fontSize: 14 },
    md: { padding: density === 'compact' ? '7px 16px' : '10px 22px', fontSize: 17 },
    lg: { padding: density === 'compact' ? '10px 24px' : '16px 36px', fontSize: 22 },
  };
  const radii = { sketchy: '3px 8px 3px 8px / 8px 3px 8px 3px', pill: '999px', sharp: '2px' };
  const sz = sizes[size] || sizes.md;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        fontFamily: "'Caveat',cursive", fontWeight: 700, lineHeight: 1.4,
        fontSize: sz.fontSize, padding: sz.padding,
        background: isDanger ? t.danger : isPrimary ? t.ink : isGhost ? 'transparent' : t.surface,
        color: isPrimary || isDanger ? t.bg : t.ink,
        border: `2px solid ${isDanger ? t.danger : t.ink}`,
        borderRadius: radii[btnShape] || radii.sketchy,
        cursor: 'pointer',
        transform: hov ? 'translateY(-1px)' : 'none',
        transition: 'all 0.1s',
        letterSpacing: '0.02em',
        boxShadow: hov
          ? `4px 4px 0 ${isDanger ? t.danger : t.accent}`
          : `3px 3px 0 ${isDanger ? t.danger + '88' : t.accent + '66'}`,
        outline: 'none',
        ...style,
      }}
    >{children}</button>
  );
}

// ── DASHBOARD ──
function DashboardPage({ setPage }) {
  const t = window.__aegisTheme;
  const [checkedIn, setCheckedIn] = React.useState(false);
  const [days, setDays] = React.useState(11);
  const [hours, setHours] = React.useState(4);
  const [mins, setMins] = React.useState(37);
  const pct = ((days * 24 * 60 + hours * 60 + mins) / (14 * 24 * 60)) * 100;
  const isWarning = days < 3;

  function handleCheckIn() {
    setCheckedIn(true);
    setDays(14); setHours(0); setMins(0);
    setTimeout(() => setCheckedIn(false), 3000);
  }

  const statusColor = isWarning ? t.danger : t.accent;

  return (
    <div>
      <SectionTitle sub="HEARTBEAT MODE — CHECK-IN EVERY 14 DAYS">Still Alive Dashboard</SectionTitle>

      {/* Big heartbeat card */}
      <SketchCard style={{ marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
              time until release begins
            </div>
            <div style={{ fontFamily: "'Caveat',cursive", fontSize: 64, fontWeight: 700, color: statusColor, lineHeight: 1, letterSpacing: '-2px' }}>
              {days}d {hours}h {mins}m
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ height: 6, background: t.border, borderRadius: 99, width: 320, maxWidth: '100%' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: statusColor, borderRadius: 99, transition: 'width 0.5s' }}></div>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: t.muted, marginTop: 4 }}>
                {Math.round(pct)}% remaining in this check-in window
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {checkedIn ? (
              <div style={{
                fontFamily: "'Caveat',cursive", fontSize: 28, fontWeight: 700, color: '#4CAF50',
                border: `3px solid #4CAF50`, borderRadius: '4px 10px 4px 10px / 10px 4px 10px 4px',
                padding: '14px 28px', transform: 'rotate(1deg)',
              }}>✓ Checked In!</div>
            ) : (
              <InkButton size="lg" onClick={handleCheckIn}>
                👋 I'm Still Alive
              </InkButton>
            )}
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: t.muted, textAlign: 'center' }}>
              last check-in: 3 days ago
            </span>
          </div>
        </div>
      </SketchCard>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatPill label="Contacts" value="3" />
        <StatPill label="Legacy Items" value="12" />
        <StatPill label="Dead Drop" value={<IconCheck size={22} color="#4CAF50"/>} accent="#4CAF50" />
        <StatPill label="Mode" value={<IconHeartbeat size={22} color={t.accent}/>} />
      </div>

      {/* Activity log */}
      <SketchCard tilt={0.2}>
        <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22, fontWeight: 700, color: t.ink, marginBottom: 12 }}>Recent Activity</div>
        {[
          { time: '3d ago',  msg: 'Check-in recorded',                          icon: <IconCheck size={18} color={t.accent}/> },
          { time: '3d ago',  msg: 'Dead drop synced to S3',                     icon: <IconCloud size={18} color={t.accent}/> },
          { time: '10d ago', msg: 'Legacy packet updated — Financial section',   icon: <IconLegacy size={18} color={t.accent}/> },
          { time: '17d ago', msg: 'Check-in recorded',                          icon: <IconCheck size={18} color={t.accent}/> },
          { time: '17d ago', msg: 'Contact added: Sarah M.',                    icon: <IconContacts size={18} color={t.accent}/> },
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex', gap: 12, alignItems: 'center',
            padding: '8px 0', borderBottom: i < 4 ? `1px dashed ${t.border}` : 'none',
          }}>
            <span style={{ fontFamily: "'Caveat',cursive", fontSize: 18, fontWeight: 700, color: t.accent, width: 20, textAlign: 'center' }}>{item.icon}</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.ink, flex: 1 }}>{item.msg}</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted }}>{item.time}</span>
          </div>
        ))}
      </SketchCard>

      <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
        <InkButton variant="ghost" size="sm" onClick={() => setPage('release')}>⚠ Preview Release Mode</InkButton>
        <InkButton variant="ghost" size="sm" onClick={() => setPage('trigger')}>⚙ Trigger Settings</InkButton>
      </div>
    </div>
  );
}

// ── LEGACY PACKET EDITOR ──
const LEGACY_CATEGORIES = ['Financial', 'Real Estate', 'Digital Assets', 'Vehicles', 'Insurance', 'Documents', 'Instructions'];
const LEGACY_ITEMS = {
  Financial: [
    { id: 1, title: 'Chase Checking', detail: 'Acct ending in ···4821 — Primary checking account', institution: 'Chase Bank' },
    { id: 2, title: 'Fidelity IRA', detail: 'Rollover IRA from previous employer — contact Fidelity at 800-343-3548', institution: 'Fidelity' },
    { id: 3, title: 'Credit Union Savings', detail: 'Acct ending in ···2209 — Emergency fund', institution: 'Alliant CU' },
  ],
  'Real Estate': [
    { id: 4, title: 'Primary Residence', detail: '14 Oak Lane, Portland OR — Deed in fireproof safe, combo 42-07-19', institution: '' },
  ],
  'Digital Assets': [
    { id: 5, title: 'Coinbase Account', detail: 'Email: personal address. 2FA backup codes in physical envelope labelled "CRYPTO" in filing cabinet', institution: 'Coinbase' },
  ],
  Insurance: [
    { id: 6, title: 'Life Insurance', detail: 'Policy #LF-4421-88 — Northwestern Mutual — $500k term — Sarah is beneficiary', institution: 'Northwestern Mutual' },
  ],
  Documents: [
    { id: 7, title: 'Will & Trust', detail: 'Filed with Reed & Morris Law, Portland. Copy in fireproof safe.', institution: 'Reed & Morris Law' },
  ],
  Vehicles: [],
  Instructions: [
    { id: 8, title: 'Executor Notes', detail: 'Please contact James first. He has a key to the house and knows where the safe is. The combination is written on the back of the photo in my desk drawer.', institution: '' },
  ],
};

function LegacyPage() {
  const t = window.__aegisTheme;
  const [activeCategory, setActiveCategory] = React.useState('Financial');
  const [items, setItems] = React.useState(LEGACY_ITEMS);
  const [adding, setAdding] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState('');
  const [newDetail, setNewDetail] = React.useState('');
  const [newInst, setNewInst] = React.useState('');

  function addItem() {
    if (!newTitle.trim()) return;
    const newItem = { id: Date.now(), title: newTitle, detail: newDetail, institution: newInst };
    setItems(prev => ({ ...prev, [activeCategory]: [...(prev[activeCategory] || []), newItem] }));
    setNewTitle(''); setNewDetail(''); setNewInst(''); setAdding(false);
  }

  const catItems = items[activeCategory] || [];

  return (
    <div>
      <SectionTitle sub="WHAT YOUR PEOPLE NEED TO FIND">Legacy Packet</SectionTitle>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {/* Category sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 }}>
          {LEGACY_CATEGORIES.map(cat => {
            const count = (items[cat] || []).length;
            const active = cat === activeCategory;
            return (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                fontFamily: "'Caveat',cursive", fontSize: 18, fontWeight: active ? 700 : 400,
                padding: '8px 14px', textAlign: 'left',
                background: active ? t.ink : 'transparent',
                color: active ? t.bg : t.ink,
                border: `2px solid ${active ? t.ink : t.border}`,
                borderRadius: '3px 8px 3px 8px / 8px 3px 8px 3px',
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                transform: active ? 'rotate(0.3deg)' : 'none',
                transition: 'all 0.1s',
              }}>
                {cat}
                <span style={{
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
                  background: active ? t.bg : t.border, color: active ? t.ink : t.muted,
                  borderRadius: 99, padding: '1px 7px', minWidth: 18, textAlign: 'center',
                }}>{count}</span>
              </button>
            );
          })}
        </div>
        {/* Items panel */}
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {catItems.length === 0 && !adding && (
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: t.muted, padding: '24px 0', textAlign: 'center' }}>
                Nothing here yet.<br/>Add an item to get started.
              </div>
            )}
            {catItems.map((item, i) => (
              <SketchCard key={item.id} tilt={i % 2 === 0 ? 0.2 : -0.2} style={{ padding: '14px 18px' }}>
                <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22, fontWeight: 700, color: t.ink }}>{item.title}</div>
                {item.institution && (
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: t.accent, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '2px 0 6px' }}>{item.institution}</div>
                )}
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, lineHeight: 1.6 }}>{item.detail}</div>
              </SketchCard>
            ))}
            {adding ? (
              <SketchCard>
                <div style={{ fontFamily: "'Caveat',cursive", fontSize: 20, fontWeight: 700, color: t.ink, marginBottom: 12 }}>New {activeCategory} Item</div>
                {[
                  { placeholder: 'Title / Account name', val: newTitle, set: setNewTitle },
                  { placeholder: 'Institution (optional)', val: newInst, set: setNewInst },
                  { placeholder: 'Notes / instructions for your executor', val: newDetail, set: setNewDetail, multi: true },
                ].map((f, i) => f.multi ? (
                  <textarea key={i} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} rows={3}
                    style={{ width: '100%', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, padding: '8px 10px', marginBottom: 8, background: t.bg, border: `1.5px solid ${t.border}`, borderRadius: 4, color: t.ink, resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}/>
                ) : (
                  <input key={i} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                    style={{ width: '100%', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, padding: '8px 10px', marginBottom: 8, background: t.bg, border: `1.5px solid ${t.border}`, borderRadius: 4, color: t.ink, boxSizing: 'border-box', outline: 'none' }}/>
                ))}
                <div style={{ display: 'flex', gap: 8 }}>
                  <InkButton size="sm" onClick={addItem}>Add Item</InkButton>
                  <InkButton size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</InkButton>
                </div>
              </SketchCard>
            ) : (
              <InkButton variant="ghost" size="sm" onClick={() => setAdding(true)} style={{ alignSelf: 'flex-start' }}>+ Add {activeCategory} Item</InkButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CONTACT CASCADE ──
function ContactsPage() {
  const t = window.__aegisTheme;
  const [contacts, setContacts] = React.useState([
    { id: 1, name: 'James Whitfield', rel: 'Brother', email: 'james@example.com', phone: '+1 503 555 0142', delay: 0, notify: ['email', 'sms'] },
    { id: 2, name: 'Margaret Osei', rel: 'Father', email: 'dad@example.com', phone: '+1 503 555 0198', delay: 48, notify: ['email'] },
    { id: 3, name: 'Sarah Whitfield', rel: 'Sister', email: 'sarah@example.com', phone: '+1 415 555 0177', delay: 72, notify: ['email', 'sms'] },
  ]);
  const [adding, setAdding] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newRel, setNewRel] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');

  function moveUp(i) {
    if (i === 0) return;
    const c = [...contacts];
    [c[i-1], c[i]] = [c[i], c[i-1]];
    setContacts(c);
  }
  function moveDown(i) {
    if (i === contacts.length - 1) return;
    const c = [...contacts];
    [c[i], c[i+1]] = [c[i+1], c[i]];
    setContacts(c);
  }
  function remove(id) { setContacts(c => c.filter(x => x.id !== id)); }

  return (
    <div>
      <SectionTitle sub="WHO GETS NOTIFIED, AND WHEN">Contact Cascade</SectionTitle>
      <SketchCard style={{ marginBottom: 20, padding: '14px 20px' }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, lineHeight: 1.7 }}>
          Contacts are notified in order. Each receives an encrypted claim link.<br/>
          They must verify identity before unlocking the legacy packet.
        </div>
      </SketchCard>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {contacts.map((c, i) => (
          <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
            {/* Order indicator */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              minWidth: 32,
            }}>
              <span style={{ fontFamily: "'Caveat',cursive", fontSize: 28, fontWeight: 700, color: t.accent, lineHeight: 1 }}>{i + 1}</span>
              <button onClick={() => moveUp(i)} disabled={i === 0} style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.2 : 0.6, fontSize: 14, padding: 0, color: t.ink }}>▲</button>
              <button onClick={() => moveDown(i)} disabled={i === contacts.length-1} style={{ background: 'none', border: 'none', cursor: i === contacts.length-1 ? 'default' : 'pointer', opacity: i === contacts.length-1 ? 0.2 : 0.6, fontSize: 14, padding: 0, color: t.ink }}>▼</button>
            </div>
            <SketchCard tilt={i % 2 === 0 ? 0.3 : -0.2} style={{ flex: 1, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: "'Caveat',cursive", fontSize: 24, fontWeight: 700, color: t.ink, lineHeight: 1 }}>{c.name}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: t.accent, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '3px 0 8px' }}>{c.rel}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted }}>
                    {c.email} · {c.phone}
                  </div>
                </div>
                <button onClick={() => remove(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.muted, fontSize: 16, padding: 4, opacity: 0.5 }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: t.muted }}>
                  NOTIFIED {c.delay === 0 ? 'IMMEDIATELY' : `+${c.delay}H AFTER TRIGGER`}
                </span>
                {c.notify.map(n => (
                  <span key={n} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, background: t.border, color: t.ink, borderRadius: 99, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{n}</span>
                ))}
              </div>
            </SketchCard>
          </div>
        ))}
      </div>

      {adding ? (
        <SketchCard>
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22, fontWeight: 700, color: t.ink, marginBottom: 12 }}>Add Trusted Contact</div>
          {[
            { ph: 'Full name', val: newName, set: setNewName },
            { ph: 'Relationship (e.g. Brother)', val: newRel, set: setNewRel },
            { ph: 'Email address', val: newEmail, set: setNewEmail },
          ].map((f, i) => (
            <input key={i} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
              style={{ width: '100%', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, padding: '8px 10px', marginBottom: 8, background: t.bg, border: `1.5px solid ${t.border}`, borderRadius: 4, color: t.ink, boxSizing: 'border-box', outline: 'none' }} />
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <InkButton size="sm" onClick={() => { if (newName) { setContacts(c => [...c, { id: Date.now(), name: newName, rel: newRel, email: newEmail, phone: '', delay: 72, notify: ['email'] }]); setNewName(''); setNewRel(''); setNewEmail(''); setAdding(false); } }}>Add Contact</InkButton>
            <InkButton size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</InkButton>
          </div>
        </SketchCard>
      ) : (
        <InkButton variant="ghost" size="sm" onClick={() => setAdding(true)}>+ Add Contact</InkButton>
      )}
    </div>
  );
}

// ── TRIGGER SETTINGS ──
function TriggerPage() {
  const t = window.__aegisTheme;
  const [mode, setMode] = React.useState('heartbeat');
  const [interval, setInterval] = React.useState(14);
  const [warnDays, setWarnDays] = React.useState(3);
  const [tripDate, setTripDate] = React.useState('2026-06-15');
  const [grace, setGrace] = React.useState(3);

  return (
    <div>
      <SectionTitle sub="CONFIGURE YOUR SWITCH">Trigger Settings</SectionTitle>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { key: 'heartbeat', icon: <IconHeartbeat size={22} color="currentColor"/>, label: 'Heartbeat Mode', desc: 'Must check in every N days' },
          { key: 'trip',      icon: <IconPlane size={22} color="currentColor"/>,    label: 'Trip Mode',       desc: 'One-time trigger after a date' },
        ].map(m => (
          <button key={m.key} onClick={() => setMode(m.key)} style={{
            fontFamily: "'Caveat',cursive", fontWeight: 700, fontSize: 20,
            padding: '14px 24px', cursor: 'pointer',
            background: mode === m.key ? t.ink : t.surface,
            color: mode === m.key ? t.bg : t.ink,
            border: `2px solid ${t.ink}`,
            borderRadius: '3px 10px 3px 10px / 10px 3px 10px 3px',
            transform: mode === m.key ? 'rotate(-0.5deg)' : 'rotate(0.3deg)',
            boxShadow: mode === m.key ? `3px 3px 0 ${t.accent}` : 'none',
            transition: 'all 0.15s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ opacity: 0.85 }}>{m.icon}</span>
              {m.label}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, opacity: 0.6, fontWeight: 400, marginTop: 4 }}>{m.desc}</div>
          </button>
        ))}
      </div>

      {mode === 'heartbeat' ? (
        <SketchCard>
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 24, fontWeight: 700, color: t.ink, marginBottom: 16 }}>Heartbeat Configuration</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Check-in interval</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="range" min={1} max={90} value={interval} onChange={e => setInterval(+e.target.value)}
                  style={{ flex: 1, accentColor: t.accent }} />
                <span style={{ fontFamily: "'Caveat',cursive", fontSize: 28, fontWeight: 700, color: t.accent, minWidth: 80 }}>{interval} days</span>
              </div>
            </div>
            <div>
              <label style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Warning window before release</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="range" min={1} max={7} value={warnDays} onChange={e => setWarnDays(+e.target.value)}
                  style={{ flex: 1, accentColor: t.accent }} />
                <span style={{ fontFamily: "'Caveat',cursive", fontSize: 28, fontWeight: 700, color: t.accent, minWidth: 80 }}>{warnDays} days</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 20, padding: '12px 16px', background: t.bg, border: `1.5px dashed ${t.border}`, borderRadius: 6 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, lineHeight: 1.7 }}>
              If you miss a check-in, Aegis will send you a warning notification.<br/>
              After <strong>{warnDays} days</strong> of no response, the release process begins.
            </div>
          </div>
        </SketchCard>
      ) : (
        <SketchCard>
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 24, fontWeight: 700, color: t.ink, marginBottom: 16 }}>Trip Configuration</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Expected return date</label>
              <input type="date" value={tripDate} onChange={e => setTripDate(e.target.value)}
                style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, padding: '8px 12px', background: t.bg, border: `1.5px solid ${t.border}`, borderRadius: 4, color: t.ink, outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Grace period after return date</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="range" min={0} max={14} value={grace} onChange={e => setGrace(+e.target.value)}
                  style={{ flex: 1, accentColor: t.accent }} />
                <span style={{ fontFamily: "'Caveat',cursive", fontSize: 28, fontWeight: 700, color: t.accent, minWidth: 80 }}>{grace} days</span>
              </div>
            </div>
          </div>
        </SketchCard>
      )}

      <div style={{ marginTop: 20 }}>
        <InkButton>Save Trigger Settings</InkButton>
      </div>
    </div>
  );
}

// ── RELEASE MODE ──
function ReleasePage({ setPage }) {
  const t = window.__aegisTheme;
  const [aborted, setAborted] = React.useState(false);
  const [hours, setHours] = React.useState(47);
  const [mins, setMins] = React.useState(12);

  if (aborted) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontFamily: "'Caveat',cursive", fontSize: 64, fontWeight: 700, color: '#4CAF50' }}>
          ✓ Aborted
        </div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, color: t.muted, marginTop: 12 }}>
          Release cancelled. Check-in window reset.
        </div>
        <div style={{ marginTop: 24 }}>
          <InkButton onClick={() => setPage('dashboard')}>Back to Dashboard</InkButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Big warning banner */}
      <div style={{
        background: t.danger, color: '#fff',
        border: `3px solid ${t.danger}`,
        borderRadius: '4px 12px 4px 12px / 12px 4px 12px 4px',
        padding: '18px 24px', marginBottom: 24,
        transform: 'rotate(-0.3deg)',
        fontFamily: "'Caveat',cursive",
        fontSize: 28, fontWeight: 700,
      }}>
        ⚠ WARNING — Release Process Active
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SketchCard style={{ textAlign: 'center', padding: '28px' }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            Time until legacy packet is released
          </div>
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 72, fontWeight: 700, color: t.danger, lineHeight: 1 }}>
            {hours}h {mins}m
          </div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, margin: '12px 0 20px' }}>
            You missed your check-in. Contacts are being notified.
          </div>
          <InkButton variant="danger" size="lg" onClick={() => setAborted(true)}>
            🛑 ABORT — I'm Alive
          </InkButton>
        </SketchCard>

        <SketchCard>
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22, fontWeight: 700, color: t.ink, marginBottom: 14 }}>Notification Timeline</div>
          {[
            { time: 'Now', who: 'James Whitfield (Brother)', status: 'Notified', done: true },
            { time: '+48h', who: 'Margaret Osei (Father)', status: 'Pending', done: false },
            { time: '+72h', who: 'Sarah Whitfield (Sister)', status: 'Pending', done: false },
            { time: `+${hours}h ${mins}m`, who: 'Legacy Packet Released', status: 'Scheduled', done: false },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', gap: 14, alignItems: 'center',
              padding: '10px 0', borderBottom: i < 3 ? `1px dashed ${t.border}` : 'none',
            }}>
              <span style={{ fontFamily: "'Caveat',cursive", fontSize: 16, fontWeight: 700, color: item.done ? t.accent : t.muted, minWidth: 54 }}>{item.time}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.ink, flex: 1 }}>{item.who}</span>
              <span style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 9, borderRadius: 99, padding: '2px 8px',
                background: item.done ? t.accent : t.border, color: item.done ? '#fff' : t.muted,
                textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>{item.status}</span>
            </div>
          ))}
        </SketchCard>

        <SketchCard tilt={-0.3}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, lineHeight: 1.8 }}>
            <strong style={{ color: t.ink, fontFamily: "'Caveat',cursive", fontSize: 17 }}>Not dead?</strong><br />
            Click "Abort" above to cancel the release and reset your check-in window. You'll be asked to authenticate first.
          </div>
        </SketchCard>
      </div>
    </div>
  );
}

// ── DEPLOYMENT MODE ──
function DeploymentPage() {
  const t = window.__aegisTheme;
  const [selected, setSelected] = React.useState('relay');

  const modes = [
    {
      key: 'selfhosted',
      name: 'Self-Hosted',
      sub: 'Open Source · Free',
      icon: <IconSelfHost size={28} color="currentColor"/>,
      desc: 'Run Aegis on your own hardware. Full control, no cloud dependency. Works on Unraid, TrueNAS, Raspberry Pi, or any VPS.',
      pros: ['Complete privacy', 'No monthly fees', 'Full source access', 'Local dead drop'],
      cons: ['Server must stay online', 'You configure SMTP/SMS', 'No relay if server dies'],
      badge: 'OSS',
    },
    {
      key: 'relay',
      name: 'Self-Hosted + Relay',
      sub: 'Aegis Relay · $4/mo',
      icon: <IconCloud size={28} color="currentColor"/>,
      desc: 'Keep estate data on your server. Let Aegis Relay monitor heartbeats and deliver notifications even if your home server goes offline.',
      pros: ['Data stays local', 'Cloud monitoring backup', 'Reliable notifications', 'Executor claim portal'],
      cons: ['Monthly subscription', 'Relay sees encrypted pings'],
      badge: 'RECOMMENDED',
    },
    {
      key: 'hosted',
      name: 'Fully Hosted',
      sub: 'Aegis Hosted · $9/mo',
      icon: <IconDeployment size={28} color="currentColor"/>,
      desc: 'No Docker. No config. Sign up, enter your information, done. Aegis manages everything including storage, delivery, and the claim portal.',
      pros: ['Zero setup', 'Always available', 'Executor claim portal', 'Helper Pack included'],
      cons: ['Aegis stores encrypted data', 'Higher monthly cost'],
      badge: 'EASIEST',
    },
  ];

  return (
    <div>
      <SectionTitle sub="CHOOSE YOUR DEPLOYMENT STRATEGY">Deployment Mode</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {modes.map((m, i) => {
          const active = selected === m.key;
          return (
            <div key={m.key} onClick={() => setSelected(m.key)} style={{
              background: active ? t.surface : t.bg,
              border: `${active ? 3 : 2}px solid ${active ? t.ink : t.border}`,
              borderRadius: '3px 10px 3px 10px / 10px 3px 10px 3px',
              padding: '18px 22px', cursor: 'pointer',
              transform: active ? `rotate(${i % 2 === 0 ? -0.4 : 0.3}deg)` : 'none',
              boxShadow: active ? `4px 4px 0 ${t.border}` : 'none',
              transition: 'all 0.15s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <span style={{ opacity: 0.85 }}>{m.icon}</span>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <span style={{ fontFamily: "'Caveat',cursive", fontSize: 26, fontWeight: 700, color: t.ink }}>{m.name}</span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, background: active ? t.accent : t.border, color: active ? '#fff' : t.muted, borderRadius: 99, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m.badge}</span>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.accent }}>{m.sub}</div>
                  </div>
                </div>
                <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2.5px solid ${active ? t.ink : t.border}`, background: active ? t.ink : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {active && <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.bg }}></div>}
                </div>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, lineHeight: 1.6, margin: '10px 0' }}>{m.desc}</div>
              {active && (
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div>
                    {m.pros.map(p => <div key={p} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#4CAF50', marginBottom: 2 }}>✓ {p}</div>)}
                  </div>
                  <div>
                    {m.cons.map(c => <div key={c} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, marginBottom: 2 }}>– {c}</div>)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 24 }}>
        <InkButton>Confirm Deployment Mode</InkButton>
      </div>
    </div>
  );
}

Object.assign(window, {
  DashboardPage, LegacyPage, ContactsPage, TriggerPage, ReleasePage, DeploymentPage,
  SketchCard, InkButton, SectionTitle, StatPill,
});
