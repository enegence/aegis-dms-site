import { Link } from 'react-router-dom';
import MarketingShell from '../../components/marketing/MarketingShell';
import { SketchCard } from '../../components/ui';

export default function Privacy() {
  return (
    <MarketingShell>
      <SketchCard style={{ padding: '32px 28px' }}>
        <div className="mb-8 p-4 bg-brand-surface border border-brand-border rounded-lg">
          <p className="font-sans text-xs text-brand-muted">
            <strong>Beta notice:</strong> This Privacy Policy is a working draft. It will be reviewed and finalized before general availability.
          </p>
        </div>

        <h1 className="font-hand text-5xl font-bold text-brand-ink mb-2">Privacy Policy</h1>
        <p className="font-sans text-xs text-brand-muted mb-10">Last updated: May 2026 (draft)</p>

        <div className="space-y-8 font-sans text-sm text-brand-ink">

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">What We Collect</h2>
            <ul className="list-disc list-inside space-y-2 text-brand-muted">
              <li>Account information: name, email address, password hash (Argon2id), timezone</li>
              <li>Estate data: item descriptions, contact information — all encrypted at rest (AES-256-GCM)</li>
              <li>Session data: secure HttpOnly session cookies, no persistent tracking cookies</li>
              <li>Billing data: subscription status; payment details are held by Stripe, not us</li>
              <li>Audit logs: redacted event records that never contain plaintext PII</li>
              <li>Operational logs: server logs with IP hashes (not raw IPs) where applicable</li>
            </ul>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">How We Protect Your Data</h2>
            <p className="text-brand-muted leading-relaxed mb-3">
              All sensitive estate fields (names, emails, phone numbers, account descriptions, notes) are encrypted at rest using AES-256-GCM with per-field keys. Category and title fields remain plaintext for filtering and display purposes.
            </p>
            <p className="text-brand-muted leading-relaxed">
              Passwords are never stored. Only an Argon2id hash is stored. We do not have access to your plaintext password.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">What We Don't Collect</h2>
            <ul className="list-disc list-inside space-y-2 text-brand-muted">
              <li>Payment card numbers or financial credentials — these are handled by Stripe</li>
              <li>Plaintext PII in audit logs or operational logs</li>
              <li>Passwords or private keys (and you should never store these in estate items)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Self-Hosted Aegis Core Users</h2>
            <p className="text-brand-muted leading-relaxed">
              If you use the open-source Aegis Core self-hosted version without Relay or Hosted services, your data stays entirely on your own infrastructure. Aegis project maintainers receive no telemetry or data from self-hosted deployments unless you opt into Relay or Hosted services.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Third-Party Services</h2>
            <ul className="list-disc list-inside space-y-2 text-brand-muted">
              <li><strong>Stripe</strong> — subscription billing and payment processing</li>
              <li><strong>Postmark</strong> — transactional email delivery</li>
              <li><strong>Railway</strong> — hosting infrastructure</li>
            </ul>
            <p className="text-brand-muted mt-3">Each provider has their own privacy policy governing data they receive.</p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Data Retention and Deletion</h2>
            <p className="text-brand-muted leading-relaxed">
              You may export your data or request full account deletion at any time from account settings. See our <Link to="/data-deletion" className="text-brand-accent hover:underline">Data Deletion</Link> page for details.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Contact</h2>
            <p className="text-brand-muted leading-relaxed">
              Privacy questions: <a href="mailto:privacy@aegisdms.com" className="text-brand-accent hover:underline">privacy@aegisdms.com</a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-brand-border">
          <p className="font-sans text-xs text-brand-muted">
            Related: <Link to="/terms" className="text-brand-accent hover:underline">Terms of Service</Link> · <Link to="/security" className="text-brand-accent hover:underline">Security</Link> · <Link to="/data-deletion" className="text-brand-accent hover:underline">Data Deletion</Link>
          </p>
        </div>
      </SketchCard>
    </MarketingShell>
  );
}
