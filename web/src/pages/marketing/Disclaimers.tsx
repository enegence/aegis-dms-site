import { Link } from 'react-router-dom';

export default function Disclaimers() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <nav className="border-b border-brand-border bg-brand-surface px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-hand text-2xl font-bold text-brand-ink">Aegis DMS</Link>
        <div className="flex items-center gap-4">
          <Link to="/login" className="font-sans text-sm text-brand-muted hover:text-brand-accent">Log in</Link>
          <Link to="/register" className="font-sans text-sm font-semibold px-4 py-2 bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors">Get started</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-hand text-5xl font-bold text-brand-ink mb-2">Disclaimers</h1>
        <p className="font-sans text-xs text-brand-muted mb-10">Last updated: May 2026 (draft)</p>

        <div className="space-y-8 font-sans text-sm text-brand-ink">

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Not a Will or Legal Instrument</h2>
            <p className="text-brand-muted leading-relaxed">
              Aegis is not a will, living will, trust, power of attorney, advance health directive, or any other legal document. Information stored in Aegis does not have legal effect on the distribution of your assets, guardianship of dependents, or any other legally significant outcome. You must maintain valid legal instruments through qualified legal counsel.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">No Guaranteed Asset Transfer</h2>
            <p className="text-brand-muted leading-relaxed">
              Aegis facilitates delivery of information and instructions to your designated contacts. It does not guarantee the transfer of any asset, financial account, property, cryptocurrency, or other item of value. Your contacts are not legally obligated to act on information delivered by Aegis. Actual asset transfer requires legal instruments and, in most jurisdictions, probate processes.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Alpha / Pre-Release Software</h2>
            <p className="text-brand-muted leading-relaxed">
              Aegis is currently in alpha. It is pre-release software with known limitations:
            </p>
            <ul className="list-disc list-inside space-y-2 text-brand-muted mt-3">
              <li>No independent third-party security audit has been conducted</li>
              <li>Pricing, features, and service terms may change before general availability</li>
              <li>Service availability is not guaranteed during the alpha period</li>
              <li>The platform may contain bugs that affect data storage, delivery, or release flows</li>
            </ul>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">No Guarantee of Delivery</h2>
            <p className="text-brand-muted leading-relaxed">
              Aegis makes reasonable efforts to deliver estate packages to designated contacts when a release trigger is activated. However, delivery depends on factors outside our control: contact email addresses may change or become inactive, spam filters may block delivery, contacts may not respond, and service outages can occur. We do not guarantee that contacts will receive, open, or act on delivery notifications.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">No Legal or Financial Advice</h2>
            <p className="text-brand-muted leading-relaxed">
              Nothing in the Aegis platform, documentation, or marketing materials constitutes legal, financial, tax, or estate planning advice. Consult qualified professionals for your jurisdiction-specific needs.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Limitation of Liability</h2>
            <p className="text-brand-muted leading-relaxed">
              To the maximum extent permitted by applicable law, Aegis and its operators disclaim all liability for damages arising from use or inability to use the service, including but not limited to loss of data, failed deliveries, or reliance on information stored in Aegis for estate planning purposes. Use of this service is at your own risk.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-brand-border">
          <p className="font-sans text-xs text-brand-muted">
            Related: <Link to="/terms" className="text-brand-accent hover:underline">Terms of Service</Link> · <Link to="/security" className="text-brand-accent hover:underline">Security</Link> · <Link to="/acceptable-use" className="text-brand-accent hover:underline">Acceptable Use</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
