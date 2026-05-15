import { Link } from 'react-router-dom';

const PRODUCTS = [
  {
    name: 'Aegis Hosted',
    tag: 'Fully managed · No server required',
    description:
      'A complete managed service for non-technical users. Aegis Hosted handles storage, switch monitoring, and contact notification in one place. Release material is encrypted server-side — you are trusting Aegis with server-managed encryption in v1.',
    cta: 'Create account',
    href: '/register',
    external: false,
  },
  {
    name: 'Aegis Relay',
    tag: 'SaaS add-on · For self-hosters',
    description:
      'Heartbeat monitoring for Aegis Core instances. Relay detects missed check-ins and alerts you. Relay Escrow can hold release material on your behalf — available as a paid add-on.',
    cta: 'Get started',
    href: '/register',
    external: false,
  },
  {
    name: 'Aegis Core',
    tag: 'Open-source · Self-hosted · AGPL-3.0',
    description:
      'A self-hosted application for managing and releasing digital legacy information. Run it on your own server with full control over your data. SQLite-backed, no cloud dependencies required.',
    cta: 'View on GitHub',
    href: 'https://github.com/your-org/aegis',
    external: true,
  },
  {
    name: 'DeadDrop API',
    tag: 'Coming soon · Platform layer',
    description:
      'A future infrastructure API for developers and platforms who want to build legacy-release functionality into their own products. Not yet available — we are designing this layer now.',
    cta: null,
    href: null,
    external: false,
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Nav */}
      <nav className="border-b border-brand-border bg-brand-surface px-6 py-4 flex items-center justify-between">
        <span className="font-hand text-2xl font-bold text-brand-ink">Aegis DMS</span>
        <div className="flex items-center gap-4">
          <Link to="/pricing" className="font-sans text-sm text-brand-muted hover:text-brand-accent">
            Pricing
          </Link>
          <Link
            to="/login"
            className="font-sans text-sm text-brand-muted hover:text-brand-accent"
          >
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

      {/* Hero */}
      <section className="px-6 py-20 text-center max-w-3xl mx-auto">
        <h1 className="font-hand text-5xl font-bold text-brand-ink mb-4 leading-tight">
          Legacy-release infrastructure
        </h1>
        <p className="font-sans text-lg text-brand-muted mb-2">
          Aegis is legacy-release infrastructure for self-hosters, families, and future platform integrations.
        </p>
        <p className="font-sans text-sm text-brand-muted mb-8 max-w-xl mx-auto">
          Organize estate information, designate trusted contacts, and configure automated release
          under conditions you define — a missed check-in, a fixed date, or a manual trigger.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            to="/register"
            className="font-sans font-semibold text-sm px-6 py-3 bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors"
          >
            Create free account
          </Link>
          <Link
            to="/pricing"
            className="font-sans text-sm px-6 py-3 border border-brand-border text-brand-ink rounded hover:border-brand-accent transition-colors"
          >
            View pricing
          </Link>
        </div>

        {/* Alpha disclaimer */}
        <p className="mt-8 font-sans text-xs text-brand-muted p-3 bg-brand-surface border border-brand-border rounded max-w-md mx-auto">
          Alpha software. Not a legal instrument. Does not replace a will, trust, or attorney.
          Security has not been independently audited. Use at your own risk.
        </p>
      </section>

      {/* Products */}
      <section className="px-6 pb-20 max-w-4xl mx-auto">
        <h2 className="font-hand text-3xl font-bold text-brand-ink mb-8 text-center">
          Four product surfaces
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {PRODUCTS.map((product) => (
            <div
              key={product.name}
              className="p-6 bg-brand-surface border border-brand-border rounded-lg flex flex-col"
            >
              <p className="font-sans text-xs text-brand-muted mb-1">{product.tag}</p>
              <h3 className="font-hand text-2xl font-bold text-brand-ink mb-2">{product.name}</h3>
              <p className="font-sans text-sm text-brand-muted flex-1 mb-4">
                {product.description}
              </p>
              {product.cta && product.href && (
                product.external ? (
                  <a
                    href={product.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-sans text-sm text-brand-accent hover:underline"
                  >
                    {product.cta} &rarr;
                  </a>
                ) : (
                  <Link
                    to={product.href}
                    className="font-sans text-sm text-brand-accent hover:underline"
                  >
                    {product.cta} &rarr;
                  </Link>
                )
              )}
              {!product.cta && (
                <p className="font-sans text-xs text-brand-muted italic">Coming in a future phase</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-brand-border bg-brand-surface px-6 py-8 text-center">
        <p className="font-sans text-xs text-brand-muted mb-3">
          &copy; {new Date().getFullYear()} Aegis DMS. Open-source core under AGPL-3.0.
        </p>
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
          {' · '}
          <Link to="/data-deletion" className="text-brand-accent hover:underline">Data Deletion</Link>
        </p>
      </footer>
    </div>
  );
}
