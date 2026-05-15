import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../../lib/api';

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
    <div className="min-h-screen bg-brand-bg">
      {/* Nav */}
      <nav className="border-b border-brand-border bg-brand-surface px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-hand text-2xl font-bold text-brand-ink">
          Aegis DMS
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/login" className="font-sans text-sm text-brand-muted hover:text-brand-accent">
            Log in
          </Link>
          <Link
            to="/register"
            className="font-sans text-sm font-semibold px-4 py-2 bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="font-hand text-5xl font-bold text-brand-ink mb-3 text-center">Pricing</h1>
        <p className="font-sans text-sm text-brand-muted text-center mb-10">
          All prices are indicative during alpha. Plans and pricing may change before general
          availability.
        </p>

        {loading && (
          <p className="font-sans text-sm text-brand-muted text-center">Loading plans...</p>
        )}

        {error && (
          <p className="font-sans text-sm text-brand-danger text-center mb-6">{error}</p>
        )}

        {!loading && plans.length === 0 && !error && (
          <div className="text-center p-8 bg-brand-surface border border-brand-border rounded-lg">
            <p className="font-sans text-sm text-brand-muted">
              Pricing is not yet published for this phase.
            </p>
            <p className="font-sans text-sm text-brand-muted mt-1">
              <a
                href="mailto:hello@aegisdms.com"
                className="text-brand-accent hover:underline"
              >
                Contact us
              </a>{' '}
              for early access pricing.
            </p>
          </div>
        )}

        {plans.length > 0 && (
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`p-6 rounded-lg flex flex-col border-2 ${
                  plan.highlighted
                    ? 'bg-brand-ink text-brand-bg border-brand-ink'
                    : 'bg-brand-surface border-brand-border'
                }`}
              >
                <h2
                  className={`font-hand text-2xl font-bold mb-1 ${
                    plan.highlighted ? 'text-brand-bg' : 'text-brand-ink'
                  }`}
                >
                  {plan.name}
                </h2>
                <p
                  className={`font-sans text-xs mb-4 ${
                    plan.highlighted ? 'text-brand-bg opacity-70' : 'text-brand-muted'
                  }`}
                >
                  {plan.description}
                </p>

                {/* Price */}
                <div className="mb-4">
                  {plan.price !== null ? (
                    <p
                      className={`font-hand text-4xl font-bold ${
                        plan.highlighted ? 'text-brand-bg' : 'text-brand-ink'
                      }`}
                    >
                      ${plan.price}
                      <span
                        className={`font-sans text-sm font-normal ml-1 ${
                          plan.highlighted ? 'opacity-70' : 'text-brand-muted'
                        }`}
                      >
                        /mo
                      </span>
                    </p>
                  ) : (
                    <div>
                      {plan.pricingUrl ? (
                        <a
                          href={plan.pricingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`font-sans text-sm hover:underline ${
                            plan.highlighted ? 'text-brand-bg' : 'text-brand-accent'
                          }`}
                        >
                          View current pricing &rarr;
                        </a>
                      ) : (
                        <p
                          className={`font-sans text-sm italic ${
                            plan.highlighted ? 'text-brand-bg opacity-70' : 'text-brand-muted'
                          }`}
                        >
                          Pricing coming soon
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Features */}
                {plan.features.length > 0 && (
                  <ul className="space-y-1 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="font-sans text-xs flex items-start gap-2">
                        <span
                          className={plan.highlighted ? 'text-brand-bg' : 'text-brand-success'}
                        >
                          ✓
                        </span>
                        <span
                          className={
                            plan.highlighted ? 'text-brand-bg opacity-80' : 'text-brand-muted'
                          }
                        >
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <Link
                  to="/register"
                  className={`font-sans font-semibold text-sm text-center px-4 py-2 rounded transition-colors ${
                    plan.highlighted
                      ? 'bg-brand-bg text-brand-ink hover:bg-brand-accent hover:text-brand-bg'
                      : 'bg-brand-ink text-brand-bg hover:bg-brand-accent'
                  }`}
                >
                  Get started
                </Link>
              </div>
            ))}
          </div>
        )}

        <p className="mt-10 font-sans text-xs text-brand-muted text-center p-3 bg-brand-surface border border-brand-border rounded max-w-md mx-auto">
          Alpha software. Not a legal instrument. Does not replace a will, trust, or attorney.
          Security has not been independently audited. Use at your own risk.
        </p>

        <div className="mt-6 text-center">
          <p className="font-sans text-xs text-brand-muted">
            <Link to="/terms" className="text-brand-accent hover:underline">Terms</Link>
            {' · '}
            <Link to="/privacy" className="text-brand-accent hover:underline">Privacy</Link>
            {' · '}
            <Link to="/security" className="text-brand-accent hover:underline">Security</Link>
            {' · '}
            <Link to="/disclaimers" className="text-brand-accent hover:underline">Disclaimers</Link>
            {' · '}
            <Link to="/acceptable-use" className="text-brand-accent hover:underline">Acceptable Use</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
