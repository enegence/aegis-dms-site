import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../lib/theme';
import { AegisLockup, AegisMascot } from '../brand';

const LEGAL_LINKS: [string, string][] = [
  ['Terms', '/terms'],
  ['Privacy', '/privacy'],
  ['Security', '/security'],
  ['Disclaimers', '/disclaimers'],
  ['Acceptable Use', '/acceptable-use'],
  ['Data Deletion', '/data-deletion'],
];

export default function MarketingShell({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <div style={{ fontFamily: "'JetBrains Mono',monospace", color: t.ink, background: t.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'center' }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <AegisLockup size="sm" color={t.ink} />
        </Link>
      </header>

      <main style={{ flex: 1, padding: '40px 24px', maxWidth: 880, margin: '0 auto', width: '100%' }}>
        {children}
      </main>

      <footer style={{ borderTop: `2px dashed ${t.border}`, padding: '24px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <AegisMascot height={36} color={t.muted} />
        </div>
        <div style={{ fontSize: 11, color: t.muted, letterSpacing: '0.08em' }}>
          AEGIS IS NOT A WILL, TRUST, OR LEGAL DOCUMENT. IT IS A METADATA DELIVERY SYSTEM.
        </div>
        <div style={{ fontSize: 11, color: t.muted, marginTop: 6, opacity: 0.6 }}>
          © {new Date().getFullYear()} Aegis DMS — Open-source core under AGPL-3.0.
        </div>
        <div style={{ fontSize: 11, color: t.muted, marginTop: 10 }}>
          {LEGAL_LINKS.map(([label, to], i) => (
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
