import { Link } from 'react-router-dom';
import MarketingShell from '../../components/marketing/MarketingShell';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'products', label: 'Products' },
  { id: 'concepts', label: 'Key Concepts' },
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'security', label: 'Security Model' },
  { id: 'trust', label: 'Trust & Limitations' },
];

export default function Docs() {
  return (
    <MarketingShell>

      <div className="max-w-5xl mx-auto px-6 py-12 flex gap-12">
        {/* Sidebar TOC */}
        <aside className="hidden md:block w-48 flex-shrink-0">
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-brand-muted mb-4">Contents</p>
          <ul className="space-y-2">
            {SECTIONS.map(s => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="font-sans text-sm text-brand-muted hover:text-brand-accent"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <h1 className="font-hand text-5xl font-bold text-brand-ink mb-2">Documentation</h1>
          <p className="font-sans text-brand-muted mb-12">Aegis DMS alpha — legacy-release infrastructure for self-hosters, families, and future platform integrations.</p>

          {/* Overview */}
          <section id="overview" className="mb-12">
            <h2 className="font-hand text-3xl font-bold text-brand-ink mb-4">Overview</h2>
            <p className="font-sans text-sm text-brand-muted leading-relaxed mb-4">
              Aegis DMS is a dead man's switch system for digital legacy. It monitors that you are still active and, if you stop checking in, releases pre-configured information to designated contacts.
            </p>
            <p className="font-sans text-sm text-brand-muted leading-relaxed mb-4">
              Use cases include: distributing passwords and account access to family, notifying executors of estate details, or delivering sensitive instructions that should only be shared after your death or incapacitation.
            </p>
            <p className="font-sans text-sm text-brand-muted leading-relaxed">
              Aegis is in alpha. All pricing is a placeholder. Do not rely on it for legally binding document delivery.
            </p>
          </section>

          <hr className="border-brand-border mb-12" />

          {/* Products */}
          <section id="products" className="mb-12">
            <h2 className="font-hand text-3xl font-bold text-brand-ink mb-6">Products</h2>

            <div className="space-y-8">
              <div>
                <h3 className="font-sans text-base font-semibold text-brand-ink mb-1">Aegis Hosted</h3>
                <p className="font-sans text-xs text-brand-accent mb-2">Fully managed · No server required</p>
                <p className="font-sans text-sm text-brand-muted leading-relaxed">
                  A complete managed service for non-technical users. Aegis Hosted handles storage, switch monitoring, and contact notification. Release material is encrypted server-side — you are trusting Aegis with server-managed encryption in v1.
                </p>
              </div>

              <div>
                <h3 className="font-sans text-base font-semibold text-brand-ink mb-1">Aegis Relay</h3>
                <p className="font-sans text-xs text-brand-accent mb-2">SaaS add-on · For self-hosters</p>
                <p className="font-sans text-sm text-brand-muted leading-relaxed">
                  Heartbeat monitoring for Aegis Core instances. Relay detects missed check-ins and can alert you or trigger release. Relay Escrow can hold release material on your behalf as a paid add-on.
                </p>
              </div>

              <div>
                <h3 className="font-sans text-base font-semibold text-brand-ink mb-1">Aegis Core</h3>
                <p className="font-sans text-xs text-brand-accent mb-2">Open-source · Self-hosted · AGPL-3.0</p>
                <p className="font-sans text-sm text-brand-muted leading-relaxed">
                  A self-hosted application for managing and releasing digital legacy information. Run it on your own server with full control over your data. SQLite-backed, no cloud dependencies required unless you opt into Relay.
                </p>
              </div>

              <div>
                <h3 className="font-sans text-base font-semibold text-brand-ink mb-1">DeadDrop API</h3>
                <p className="font-sans text-xs text-brand-accent mb-2">Coming soon · Platform layer</p>
                <p className="font-sans text-sm text-brand-muted leading-relaxed">
                  A future infrastructure API for developers and platforms who want to build legacy-release functionality into their own products. Not yet available — design is in progress.
                </p>
              </div>
            </div>
          </section>

          <hr className="border-brand-border mb-12" />

          {/* Key Concepts */}
          <section id="concepts" className="mb-12">
            <h2 className="font-hand text-3xl font-bold text-brand-ink mb-6">Key Concepts</h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-sans text-base font-semibold text-brand-ink mb-2">Dead man's switch</h3>
                <p className="font-sans text-sm text-brand-muted leading-relaxed">
                  A mechanism that triggers an action when you stop actively preventing it. Aegis requires periodic check-ins. If you miss your window, it considers you incapacitated and begins the release process.
                </p>
              </div>

              <div>
                <h3 className="font-sans text-base font-semibold text-brand-ink mb-2">Release runs</h3>
                <p className="font-sans text-sm text-brand-muted leading-relaxed">
                  A release run is the event where Aegis delivers your estate information to your contacts. Only one active release run can exist per account at a time. Release runs are irreversible once contacts have been notified.
                </p>
              </div>

              <div>
                <h3 className="font-sans text-base font-semibold text-brand-ink mb-2">Estate items</h3>
                <p className="font-sans text-sm text-brand-muted leading-relaxed">
                  Structured records of your digital assets and accounts — including access credentials, important locations, and executor notes. Estate items are encrypted at rest.
                </p>
              </div>

              <div>
                <h3 className="font-sans text-base font-semibold text-brand-ink mb-2">Contacts</h3>
                <p className="font-sans text-sm text-brand-muted leading-relaxed">
                  Trusted recipients who receive your release material. Contacts receive a claim link via email and must verify their identity before accessing your estate information.
                </p>
              </div>

              <div>
                <h3 className="font-sans text-base font-semibold text-brand-ink mb-2">Relay Monitoring vs Relay Escrow</h3>
                <p className="font-sans text-sm text-brand-muted leading-relaxed">
                  Relay Monitoring tracks heartbeats from your self-hosted Aegis Core instance. Relay Escrow holds release material on your behalf for delivery when a trigger fires. These are distinct features — monitoring alone does not release anything.
                </p>
              </div>
            </div>
          </section>

          <hr className="border-brand-border mb-12" />

          {/* Getting Started */}
          <section id="getting-started" className="mb-12">
            <h2 className="font-hand text-3xl font-bold text-brand-ink mb-6">Getting Started</h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-sans text-base font-semibold text-brand-ink mb-2">Aegis Hosted</h3>
                <ol className="font-sans text-sm text-brand-muted space-y-2 list-decimal list-inside">
                  <li>Create an account at <Link to="/register" className="text-brand-accent hover:underline">/register</Link></li>
                  <li>Complete the onboarding flow — choose Hosted, review the trust model, and acknowledge it</li>
                  <li>Add at least one contact and one estate item</li>
                  <li>Enable your dead man's switch and set a check-in interval</li>
                  <li>Check in regularly to prevent a release run from triggering</li>
                </ol>
              </div>

              <div>
                <h3 className="font-sans text-base font-semibold text-brand-ink mb-2">Aegis Relay (self-hosters)</h3>
                <ol className="font-sans text-sm text-brand-muted space-y-2 list-decimal list-inside">
                  <li>Install and configure Aegis Core on your own server</li>
                  <li>Create an account and subscribe to the Relay plan</li>
                  <li>Generate an API key in your Aegis Core instance</li>
                  <li>Connect Core to Relay via the Relay settings panel</li>
                  <li>Send a test heartbeat to confirm the connection</li>
                </ol>
              </div>
            </div>
          </section>

          <hr className="border-brand-border mb-12" />

          {/* Security */}
          <section id="security" className="mb-12">
            <h2 className="font-hand text-3xl font-bold text-brand-ink mb-4">Security Model</h2>
            <p className="font-sans text-sm text-brand-muted leading-relaxed mb-4">
              All PII fields (names, emails, account details, executor notes) are encrypted at rest using AES-256-GCM. Audit logs never contain plaintext PII. Passwords are hashed with Argon2id. Password reset tokens are SHA-256 hashed and single-use with a 15-minute expiry.
            </p>
            <p className="font-sans text-sm text-brand-muted leading-relaxed mb-4">
              Sessions use HttpOnly cookies with SameSite=Lax. CSRF protection is required on all state-changing requests. Rate limiting applies to auth endpoints.
            </p>
            <p className="font-sans text-sm text-brand-muted leading-relaxed">
              For Aegis Hosted v1, encryption keys are server-managed. There is no client-side or zero-knowledge encryption in v1. If you need full key control, use Aegis Core (self-hosted).
            </p>
          </section>

          <hr className="border-brand-border mb-12" />

          {/* Trust & Limitations */}
          <section id="trust" className="mb-12">
            <h2 className="font-hand text-3xl font-bold text-brand-ink mb-4">Trust & Limitations</h2>
            <p className="font-sans text-sm text-brand-muted leading-relaxed mb-4">
              Aegis is in alpha. We do not claim:
            </p>
            <ul className="font-sans text-sm text-brand-muted space-y-2 list-disc list-inside mb-4">
              <li>Guaranteed delivery — email delivery depends on third-party infrastructure</li>
              <li>Legal equivalence to a will or estate document</li>
              <li>Zero-knowledge encryption — Hosted v1 uses server-managed keys</li>
              <li>Bank-level security — we apply reasonable security practices for an alpha product</li>
              <li>Shamir secret sharing — not implemented</li>
            </ul>
            <p className="font-sans text-sm text-brand-muted leading-relaxed">
              Aegis is infrastructure. It does not provide legal, financial, or estate-planning advice. Consult a professional for legally binding arrangements.
            </p>
          </section>

          <div className="pt-4">
            <Link
              to="/register"
              className="font-sans text-sm font-semibold px-6 py-3 bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors"
            >
              Get started
            </Link>
          </div>
        </main>
      </div>

    </MarketingShell>
  );
}
