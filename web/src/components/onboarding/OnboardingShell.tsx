import type { ReactNode } from 'react';
import { useTheme } from '../../lib/theme';
import { AegisLockup } from '../brand';
import { SketchCard } from '../ui';

interface OnboardingShellProps {
  title: string;
  subtitle?: string;
  currentStep: number;
  totalSteps: number;
  children: ReactNode;
}

/**
 * OnboardingShell — sketch-aesthetic layout wrapper for all onboarding step pages.
 * Branded card with step-dot progress, title, and a slot for step content.
 */
export default function OnboardingShell({
  title,
  subtitle,
  currentStep,
  totalSteps,
  children,
}: OnboardingShellProps) {
  const t = useTheme();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: t.bg }}>
      <div style={{ marginBottom: 24 }}>
        <AegisLockup size="sm" color={t.ink} />
      </div>

      {/* Step-dot progress */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 28 }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            style={{
              width: i + 1 === currentStep ? 28 : 10,
              height: 10,
              borderRadius: 99,
              background: i + 1 <= currentStep ? t.ink : t.border,
              transition: 'all 0.2s',
            }}
          />
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: 540 }}>
        <SketchCard style={{ padding: '28px 26px' }}>
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 28, fontWeight: 700, color: t.ink, lineHeight: 1.1 }}>
            {title}
          </div>
          {subtitle && (
            <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, margin: '6px 0 0' }}>
              {subtitle}
            </p>
          )}
          <div style={{ marginTop: 18 }}>{children}</div>
        </SketchCard>
      </div>
    </div>
  );
}
