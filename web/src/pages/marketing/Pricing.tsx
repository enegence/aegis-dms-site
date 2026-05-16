import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import MarketingShell from '../../components/marketing/MarketingShell';
import { SketchCard, InkButton, SectionTitle } from '../../components/ui';
import { IconCheck } from '../../components/icons';

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  price: number | null;
  pricingUrl?: string;
  features: string[];
  highlighted?: boolean;
}

interface PricingResponse {
  plans: PricingPlan[];
}

export default function Pricing() {
  const t = useTheme();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<PricingResponse>('/api/pricing')
      .then((r) => setPlans(r.plans))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <MarketingShell>
      <SectionTitle sub="ALL PRICES ARE INDICATIVE DURING ALPHA. PLANS AND PRICING MAY CHANGE BEFORE GENERAL AVAILABILITY.">
        Pick your level of paranoia
      </SectionTitle>

      {loading && (
        <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: t.muted, textAlign: 'center', marginTop: 24 }}>
          Loading plans...
        </p>
      )}

      {error && (
        <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: t.danger, textAlign: 'center', margin: '16px 0' }}>
          {error}
        </p>
      )}

      {!loading && plans.length === 0 && !error && (
        <SketchCard style={{ textAlign: 'center', marginTop: 16 }}>
          <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: t.muted }}>
            Pricing is not yet published for this phase.
          </p>
          <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: t.muted, marginTop: 4 }}>
            <a href="mailto:hello@aegisdms.com" style={{ color: t.accent }}>Contact us</a>{' '}
            for early access pricing.
          </p>
        </SketchCard>
      )}

      {plans.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 16 }}>
          {plans.map((plan, i) => (
            <SketchCard key={plan.id} tilt={i % 2 === 0 ? -0.4 : 0.4} style={{ padding: '24px 22px', position: 'relative' }}>
              {plan.highlighted && (
                <div style={{ position: 'absolute', top: -12, right: 18, fontFamily: "'JetBrains Mono',monospace", fontSize: 9, background: t.ink, color: t.bg, borderRadius: 99, padding: '4px 10px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  POPULAR
                </div>
              )}
              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 28, fontWeight: 700, color: t.ink }}>{plan.name}</div>
              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 42, fontWeight: 700, color: t.accent, lineHeight: 1, margin: '6px 0 4px' }}>
                {plan.price !== null ? (
                  <>${plan.price}<span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: t.muted, marginLeft: 4 }}>/mo</span></>
                ) : plan.pricingUrl ? (
                  <a href={plan.pricingUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, color: t.accent }}>
                    View current pricing →
                  </a>
                ) : (
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, color: t.muted, fontStyle: 'italic' }}>Pricing coming soon</span>
                )}
              </div>
              {plan.description && (
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, letterSpacing: '0.06em', marginBottom: 16 }}>{plan.description}</div>
              )}
              {plan.features.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  {plan.features.map((f) => (
                    <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.ink, marginBottom: 6 }}>
                      <IconCheck size={14} color={t.accent} />
                      {f}
                    </div>
                  ))}
                </div>
              )}
              <InkButton size="sm" onClick={() => navigate('/register')}>Get started</InkButton>
            </SketchCard>
          ))}
        </div>
      )}

      <p style={{ marginTop: 40, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, textAlign: 'center', lineHeight: 1.7, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', padding: '12px 16px', border: `1.5px dashed ${t.border}`, borderRadius: '3px 10px 3px 10px / 10px 3px 10px 3px' }}>
        Alpha software. Not a legal instrument. Does not replace a will, trust, or attorney. Security has not been independently audited. Use at your own risk.
      </p>
    </MarketingShell>
  );
}
