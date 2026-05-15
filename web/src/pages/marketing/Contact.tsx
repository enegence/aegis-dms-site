import { Link } from 'react-router-dom';

export default function Contact() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <nav className="border-b border-brand-border bg-brand-surface px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-hand text-2xl font-bold text-brand-ink">Aegis DMS</Link>
        <div className="flex items-center gap-4">
          <Link to="/docs" className="font-sans text-sm text-brand-muted hover:text-brand-accent">Docs</Link>
          <Link to="/login" className="font-sans text-sm text-brand-muted hover:text-brand-accent">Log in</Link>
          <Link to="/register" className="font-sans text-sm font-semibold px-4 py-2 bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors">Get started</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-8 p-4 bg-brand-surface border border-brand-border rounded-lg">
          <p className="font-sans text-xs text-brand-muted">
            <strong>Beta notice:</strong> We are in beta — response times may vary. We aim to respond to all inquiries within 2–3 business days.
          </p>
        </div>

        <h1 className="font-hand text-5xl font-bold text-brand-ink mb-2">Contact &amp; Support</h1>
        <p className="font-sans text-sm text-brand-muted mb-10">Reach us for general support, billing questions, security disclosures, or release incidents.</p>

        <div className="space-y-10 font-sans text-sm text-brand-ink">

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">General Support</h2>
            <p className="text-brand-muted leading-relaxed mb-3">
              For account help, usage questions, and general inquiries:
            </p>
            <a
              href="mailto:support@aegisdms.life"
              className="inline-block font-semibold text-brand-accent hover:underline"
            >
              support@aegisdms.life
            </a>
            <p className="text-brand-muted mt-3 leading-relaxed">
              Please include your account email and a brief description of the issue in your message.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Vulnerability Disclosure</h2>
            <p className="text-brand-muted leading-relaxed mb-3">
              If you have discovered a security vulnerability in Aegis DMS, please report it responsibly:
            </p>
            <a
              href="mailto:security@aegisdms.life"
              className="inline-block font-semibold text-brand-accent hover:underline"
            >
              security@aegisdms.life
            </a>
            <p className="text-brand-muted mt-3 leading-relaxed">
              Include <strong>"SECURITY"</strong> in the subject line. We will acknowledge your report within 48 hours and work with you to verify and address the issue before any public disclosure. Please do not file public GitHub issues for security vulnerabilities.
            </p>
            <p className="text-brand-muted mt-2 leading-relaxed">
              See our <Link to="/security" className="text-brand-accent hover:underline">Security page</Link> for our full security model and disclosure policy.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Billing and Account Escalation</h2>
            <p className="text-brand-muted leading-relaxed mb-3">
              For subscription changes, billing disputes, or account access issues:
            </p>
            <ul className="list-disc list-inside space-y-2 text-brand-muted">
              <li>
                Manage your subscription directly from the{' '}
                <Link to="/app/billing" className="text-brand-accent hover:underline">Billing portal</Link>{' '}
                (requires login)
              </li>
              <li>
                For billing disputes or payment failures not resolved via the portal, email{' '}
                <a href="mailto:support@aegisdms.life" className="text-brand-accent hover:underline">support@aegisdms.life</a>{' '}
                with "BILLING" in the subject line
              </li>
              <li>
                Refund requests are handled on a case-by-case basis — see our{' '}
                <Link to="/terms" className="text-brand-accent hover:underline">Terms of Service</Link>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Active Release Incidents</h2>
            <p className="text-brand-muted leading-relaxed">
              If you are a designated contact (beneficiary/executor) and you are experiencing an issue during an <strong>active release incident</strong> — such as a release notification that did not arrive, a claim link that is not working, or a time-sensitive access problem — contact us immediately at{' '}
              <a href="mailto:support@aegisdms.life" className="text-brand-accent hover:underline">support@aegisdms.life</a>{' '}
              with <strong>"RELEASE INCIDENT"</strong> in the subject line.
            </p>
            <p className="text-brand-muted mt-3 leading-relaxed">
              Release incidents are treated with the highest priority. We monitor support email around the clock for messages with this subject prefix.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Data Deletion Requests</h2>
            <p className="text-brand-muted leading-relaxed">
              You can request full account and data deletion from your account settings, or email{' '}
              <a href="mailto:support@aegisdms.life" className="text-brand-accent hover:underline">support@aegisdms.life</a>.
              See our <Link to="/data-deletion" className="text-brand-accent hover:underline">Data Deletion</Link> page for details on what is removed and the timeline.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-brand-border">
          <p className="font-sans text-xs text-brand-muted">
            Related: <Link to="/docs" className="text-brand-accent hover:underline">Documentation</Link> · <Link to="/security" className="text-brand-accent hover:underline">Security</Link> · <Link to="/privacy" className="text-brand-accent hover:underline">Privacy Policy</Link> · <Link to="/terms" className="text-brand-accent hover:underline">Terms of Service</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
