import type { ReactNode } from 'react';
import { useTheme } from '../../lib/theme';
import { AegisLockup, AegisMascot } from '../brand';
import { SketchCard } from '../ui';

/**
 * ClaimShell — minimal, sidebar-less sketch layout for the public claim portal.
 * Claimants are unauthenticated external contacts, so this deliberately omits
 * the app sidebar/nav.
 */
export default function ClaimShell({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: t.bg }}>
      <div style={{ marginBottom: 22 }}>
        <AegisLockup size="sm" color={t.ink} />
      </div>
      <div style={{ width: '100%', maxWidth: 520 }}>
        <SketchCard style={{ padding: '30px 28px' }}>{children}</SketchCard>
      </div>
      <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <AegisMascot height={28} color={t.muted} />
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: t.muted, letterSpacing: '0.08em', textAlign: 'center' }}>
          AEGIS IS NOT A WILL, TRUST, OR LEGAL DOCUMENT. IT IS A METADATA DELIVERY SYSTEM.
        </div>
      </div>
    </div>
  );
}
