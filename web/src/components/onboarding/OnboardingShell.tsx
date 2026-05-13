import type { ReactNode } from 'react';

interface OnboardingShellProps {
  title: string;
  subtitle?: string;
  currentStep: number;
  totalSteps: number;
  children: ReactNode;
}

/**
 * OnboardingShell — layout wrapper for all onboarding step pages.
 *
 * Renders a branded card with progress indicator, title, and slot for step content.
 * Follows the Dashboard color / typography conventions (font-hand, font-sans, brand-* tokens).
 */
export default function OnboardingShell({
  title,
  subtitle,
  currentStep,
  totalSteps,
  children,
}: OnboardingShellProps) {
  const progressPct = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-hand text-4xl font-bold text-brand-ink">Aegis Setup</h1>
          <p className="font-sans text-sm text-brand-muted mt-1">
            Step {currentStep} of {totalSteps}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-brand-surface border border-brand-border rounded-full h-2 mb-6">
          <div
            className="bg-brand-accent h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Card */}
        <div className="bg-brand-surface border border-brand-border rounded-xl p-6 shadow-sm">
          <h2 className="font-hand text-2xl font-bold text-brand-ink mb-1">{title}</h2>
          {subtitle && (
            <p className="font-sans text-sm text-brand-muted mb-4">{subtitle}</p>
          )}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
