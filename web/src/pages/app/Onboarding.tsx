import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, put, post } from '../../lib/api';
import OnboardingShell from '../../components/onboarding/OnboardingShell';

// ── Types ─────────────────────────────────────────────────────────────────────

type PreferredProduct = 'relay' | 'hosted' | 'undecided';

interface OnboardingState {
  preferredProduct: PreferredProduct;
  currentStep: string;
  completedAt: string | null;
  subscription: {
    plan: string | null;
    status: string | null;
    hasRelay: boolean;
    hasHosted: boolean;
  };
  nextRoute: string;
}

// ── Onboarding step definitions ───────────────────────────────────────────────

const HOSTED_STEPS = [
  { key: 'explain_trust_model', label: 'Understand the trust model' },
  { key: 'trust_acknowledgement', label: 'Accept trust acknowledgement' },
  { key: 'create_contact', label: 'Add your first contact' },
  { key: 'create_estate_item', label: 'Add your first estate item' },
  { key: 'create_switch', label: 'Create your first switch' },
  { key: 'review_readiness', label: 'Review readiness' },
] as const;

const RELAY_STEPS = [
  { key: 'explain_relay_modes', label: 'Understand Relay Monitoring vs Escrow' },
  { key: 'connect_self_hosted', label: 'Connect your self-hosted app' },
  { key: 'test_heartbeat', label: 'Send a test heartbeat' },
  { key: 'relay_escrow_optional', label: 'Optional: set up Relay Escrow' },
  { key: 'review_relay_status', label: 'Review relay status' },
] as const;

// ── Helper: map step key → step index ────────────────────────────────────────

function stepIndex(
  steps: ReadonlyArray<{ key: string }>,
  key: string,
): number {
  const idx = steps.findIndex(s => s.key === key);
  return idx >= 0 ? idx : 0;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProductPicker({
  onSelect,
}: {
  onSelect: (product: 'relay' | 'hosted') => void;
}) {
  return (
    <div className="space-y-4">
      <p className="font-sans text-sm text-brand-muted">
        Choose the product you want to set up first. You can switch later from your dashboard.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          onClick={() => onSelect('hosted')}
          className="p-4 bg-brand-bg border border-brand-border rounded-lg text-left hover:border-brand-accent transition-colors focus:outline-none focus:ring-2 focus:ring-brand-accent"
        >
          <p className="font-hand text-lg font-bold text-brand-ink">Aegis Hosted</p>
          <p className="font-sans text-xs text-brand-muted mt-1">
            Fully managed. Aegis stores and releases your information on your behalf.
          </p>
        </button>
        <button
          onClick={() => onSelect('relay')}
          className="p-4 bg-brand-bg border border-brand-border rounded-lg text-left hover:border-brand-accent transition-colors focus:outline-none focus:ring-2 focus:ring-brand-accent"
        >
          <p className="font-hand text-lg font-bold text-brand-ink">Aegis Relay</p>
          <p className="font-sans text-xs text-brand-muted mt-1">
            Self-hosted core app. Aegis Relay monitors heartbeats and coordinates releases.
          </p>
        </button>
      </div>
    </div>
  );
}

function BillingCTA() {
  return (
    <div className="space-y-4">
      <p className="font-sans text-sm text-brand-muted">
        You need an active subscription to proceed. Choose a plan that fits your needs.
      </p>
      <a
        href="/pricing"
        className="block w-full text-center py-2 px-4 bg-brand-accent text-white rounded-lg font-sans text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        View plans and pricing
      </a>
      <a
        href="/billing"
        className="block w-full text-center py-2 px-4 border border-brand-border rounded-lg font-sans text-sm text-brand-muted hover:border-brand-accent transition-colors"
      >
        Manage billing
      </a>
    </div>
  );
}

function HostedStepContent({
  stepKey,
  onNext,
  onComplete,
  isLast,
}: {
  stepKey: string;
  onNext: () => void;
  onComplete: () => void;
  isLast: boolean;
}) {
  const content: Record<string, { heading: string; body: string; cta?: string; ctaHref?: string }> = {
    explain_trust_model: {
      heading: 'How Hosted trust works',
      body: `With Aegis Hosted, your estate information is stored encrypted on our servers.
When your dead man's switch triggers, Aegis releases your information to the contacts you designated.
You remain in full control of what is released, to whom, and when.`,
    },
    trust_acknowledgement: {
      heading: 'Acknowledge the trust model',
      body: `By continuing, you confirm that you understand Aegis Hosted stores encrypted data on your behalf
and releases it according to your configured switch rules. You can revoke or update this at any time
while your account is active.`,
    },
    create_contact: {
      heading: 'Add your first contact',
      body: 'Contacts are the people who will receive your estate information when your switch triggers. Add at least one contact to continue.',
      cta: 'Go to Contacts',
      ctaHref: '/contacts',
    },
    create_estate_item: {
      heading: 'Add your first estate item',
      body: 'Estate items are the accounts, assets, and instructions you want to pass on. They are encrypted and only decrypted when released to your contacts.',
      cta: 'Go to Estate',
      ctaHref: '/estate',
    },
    create_switch: {
      heading: 'Create your first switch',
      body: 'A switch defines the trigger conditions for releasing your information. You can use a heartbeat (check-in) timer or a fixed date trigger.',
      cta: 'Go to Switches',
      ctaHref: '/switches',
    },
    review_readiness: {
      heading: 'Review your readiness',
      body: 'Everything looks good. Your Hosted setup is complete. You can now arm your switch from the Switches page.',
    },
  };

  const step = content[stepKey] ?? {
    heading: stepKey,
    body: 'Complete this step to continue.',
  };

  return (
    <div className="space-y-4">
      <h3 className="font-sans text-base font-semibold text-brand-ink">{step.heading}</h3>
      <p className="font-sans text-sm text-brand-muted whitespace-pre-line">{step.body}</p>
      {step.ctaHref && (
        <a
          href={step.ctaHref}
          className="inline-block mt-1 font-sans text-sm text-brand-accent hover:underline"
        >
          {step.cta} &rarr;
        </a>
      )}
      <div className="flex justify-end pt-2">
        {isLast ? (
          <button
            onClick={onComplete}
            className="py-2 px-4 bg-brand-accent text-white rounded-lg font-sans text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Complete setup
          </button>
        ) : (
          <button
            onClick={onNext}
            className="py-2 px-4 bg-brand-accent text-white rounded-lg font-sans text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Next &rarr;
          </button>
        )}
      </div>
    </div>
  );
}

function RelayStepContent({
  stepKey,
  onNext,
  onComplete,
  isLast,
}: {
  stepKey: string;
  onNext: () => void;
  onComplete: () => void;
  isLast: boolean;
}) {
  const content: Record<string, { heading: string; body: string; cta?: string; ctaHref?: string }> = {
    explain_relay_modes: {
      heading: 'Relay Monitoring vs Relay Escrow',
      body: `Relay Monitoring watches your self-hosted Aegis Core for heartbeats. If your app goes offline beyond the threshold, Aegis sends alerts and can trigger a release.

Relay Escrow adds an extra layer: you can deposit encrypted release material with Aegis so that your contacts can receive it even if your self-hosted app is permanently unreachable.`,
    },
    connect_self_hosted: {
      heading: 'Connect your self-hosted app',
      body: 'Register a relay connection and copy the API key into your self-hosted Aegis Core configuration. Your app will then send heartbeats to Aegis Relay.',
      cta: 'Go to Relay',
      ctaHref: '/relay',
    },
    test_heartbeat: {
      heading: 'Send a test heartbeat',
      body: 'After connecting, your Aegis Core app should send a heartbeat automatically. Verify the connection is active on the Relay page.',
      cta: 'View Relay status',
      ctaHref: '/relay',
    },
    relay_escrow_optional: {
      heading: 'Optional: set up Relay Escrow',
      body: 'Relay Escrow lets you store encrypted release material with Aegis. This is optional but recommended if you want guaranteed delivery even if your self-hosted app is permanently offline.',
      cta: 'Go to Relay',
      ctaHref: '/relay',
    },
    review_relay_status: {
      heading: 'Relay setup complete',
      body: 'Your relay connection is configured. Aegis will monitor heartbeats and alert you if your app goes offline. You can manage everything from the Relay page.',
    },
  };

  const step = content[stepKey] ?? {
    heading: stepKey,
    body: 'Complete this step to continue.',
  };

  return (
    <div className="space-y-4">
      <h3 className="font-sans text-base font-semibold text-brand-ink">{step.heading}</h3>
      <p className="font-sans text-sm text-brand-muted whitespace-pre-line">{step.body}</p>
      {step.ctaHref && (
        <a
          href={step.ctaHref}
          className="inline-block mt-1 font-sans text-sm text-brand-accent hover:underline"
        >
          {step.cta} &rarr;
        </a>
      )}
      <div className="flex justify-end pt-2">
        {isLast ? (
          <button
            onClick={onComplete}
            className="py-2 px-4 bg-brand-accent text-white rounded-lg font-sans text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Complete setup
          </button>
        ) : (
          <button
            onClick={onNext}
            className="py-2 px-4 bg-brand-accent text-white rounded-lg font-sans text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Next &rarr;
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Local step index drives which step card to render
  const [localStepIdx, setLocalStepIdx] = useState(0);
  // Which product surface the user is onboarding for
  const [activeProduct, setActiveProduct] = useState<'relay' | 'hosted' | null>(null);

  useEffect(() => {
    get<OnboardingState>('/api/onboarding')
      .then(data => {
        setState(data);
        // If already completed, redirect to dashboard
        if (data.completedAt) {
          navigate(data.nextRoute, { replace: true });
          return;
        }
        // Init product surface from state
        if (data.preferredProduct !== 'undecided') {
          const prod = data.preferredProduct as 'relay' | 'hosted';
          setActiveProduct(prod);
          const steps = prod === 'hosted' ? HOSTED_STEPS : RELAY_STEPS;
          setLocalStepIdx(stepIndex(steps, data.currentStep));
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleSelectProduct = async (product: 'relay' | 'hosted') => {
    setSaving(true);
    try {
      await put('/api/onboarding/preferred-product', { preferredProduct: product });
      setActiveProduct(product);
      setLocalStepIdx(0);
      setState(prev => prev ? { ...prev, preferredProduct: product } : prev);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save product choice');
    } finally {
      setSaving(false);
    }
  };

  const handleNextStep = async () => {
    if (!activeProduct) return;
    const steps = activeProduct === 'hosted' ? HOSTED_STEPS : RELAY_STEPS;
    const step = steps[localStepIdx];
    if (!step) return;

    setSaving(true);
    try {
      await post('/api/onboarding/complete-step', { step: step.key });
      const nextIdx = localStepIdx + 1;
      setLocalStepIdx(nextIdx);
      setState(prev => prev ? { ...prev, currentStep: step.key } : prev);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save step');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await post('/api/onboarding/complete', {});
      // Redirect to appropriate next route
      const nextRoute = state?.nextRoute ?? '/dashboard';
      navigate(nextRoute, { replace: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to complete onboarding');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-hand text-3xl text-brand-muted">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-brand-danger font-sans text-sm">{error}</div>
      </div>
    );
  }

  // No active subscription — show billing CTA
  if (!state?.subscription.plan) {
    return (
      <OnboardingShell
        title="Choose a plan"
        subtitle="An active subscription is required to use Aegis."
        currentStep={0}
        totalSteps={1}
      >
        <BillingCTA />
      </OnboardingShell>
    );
  }

  // User has subscription but hasn't chosen a product surface (both active or undecided)
  if (!activeProduct) {
    // If both are active, let user choose
    const hasBoth = state.subscription.hasRelay && state.subscription.hasHosted;
    const title = hasBoth
      ? 'Which product do you want to set up first?'
      : 'Set up your product';

    return (
      <OnboardingShell title={title} currentStep={0} totalSteps={1}>
        <ProductPicker onSelect={handleSelectProduct} />
        {saving && (
          <p className="font-sans text-xs text-brand-muted mt-3 text-center">Saving...</p>
        )}
      </OnboardingShell>
    );
  }

  // Render product-specific step flow
  const steps = activeProduct === 'hosted' ? HOSTED_STEPS : RELAY_STEPS;
  const currentStepDef = steps[localStepIdx] ?? steps[steps.length - 1];
  const isLast = localStepIdx >= steps.length - 1;
  const productLabel = activeProduct === 'hosted' ? 'Aegis Hosted Setup' : 'Aegis Relay Setup';

  return (
    <OnboardingShell
      title={productLabel}
      subtitle={currentStepDef.label}
      currentStep={localStepIdx + 1}
      totalSteps={steps.length}
    >
      {saving ? (
        <div className="font-sans text-sm text-brand-muted py-4 text-center">Saving...</div>
      ) : activeProduct === 'hosted' ? (
        <HostedStepContent
          stepKey={currentStepDef.key}
          onNext={handleNextStep}
          onComplete={handleComplete}
          isLast={isLast}
        />
      ) : (
        <RelayStepContent
          stepKey={currentStepDef.key}
          onNext={handleNextStep}
          onComplete={handleComplete}
          isLast={isLast}
        />
      )}

      {/* Allow switching product */}
      {(state.subscription.hasRelay && state.subscription.hasHosted) && (
        <div className="mt-4 border-t border-brand-border pt-3">
          <button
            onClick={() => setActiveProduct(null)}
            className="font-sans text-xs text-brand-muted hover:text-brand-accent transition-colors"
          >
            Switch to {activeProduct === 'hosted' ? 'Relay' : 'Hosted'} setup
          </button>
        </div>
      )}
    </OnboardingShell>
  );
}
