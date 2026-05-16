import { Link } from 'react-router-dom';
import MarketingShell from '../../components/marketing/MarketingShell';
import { SketchCard } from '../../components/ui';

export default function DataDeletion() {
  return (
    <MarketingShell>
      <SketchCard style={{ padding: '32px 28px' }}>
        <h1 className="font-hand text-5xl font-bold text-brand-ink mb-2">Data Deletion</h1>
        <p className="font-sans text-xs text-brand-muted mb-10">Last updated: May 2026 (draft)</p>

        <div className="space-y-8 font-sans text-sm text-brand-ink">

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Export Your Data First</h2>
            <p className="text-brand-muted leading-relaxed">
              Before deleting your account, we strongly recommend exporting your estate data. Your export includes estate items, contacts, switch configurations, and account metadata in JSON format. Go to <strong>Account Settings → Export Data</strong> to download your archive.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">How to Delete Your Account</h2>
            <p className="text-brand-muted leading-relaxed mb-3">
              Account deletion is available from <strong>Account Settings → Danger Zone → Delete Account</strong>. Deletion requires entering your current password as confirmation.
            </p>
            <p className="text-brand-muted leading-relaxed">
              Deletion is permanent and cannot be undone. There is no grace period or recovery option after deletion is confirmed.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">What Gets Deleted</h2>
            <ul className="list-disc list-inside space-y-2 text-brand-muted">
              <li>Your account and profile information</li>
              <li>All estate items and their encrypted content</li>
              <li>All contacts and their encrypted details</li>
              <li>All switch configurations and their state</li>
              <li>Relay connection records</li>
              <li>Relay Escrow material (if enabled)</li>
              <li>Trust acknowledgement records</li>
              <li>Notification history</li>
              <li>Active sessions</li>
            </ul>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">What May Be Retained</h2>
            <ul className="list-disc list-inside space-y-2 text-brand-muted">
              <li>Redacted audit log entries may be retained for a limited period for security and compliance purposes. These logs contain no plaintext PII.</li>
              <li>Billing records may be retained as required by Stripe and applicable financial regulations.</li>
              <li>Backups are purged on a rolling schedule; deletion from backups completes within 30 days.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Subscription Cancellation</h2>
            <p className="text-brand-muted leading-relaxed">
              Deleting your account does not automatically cancel a Stripe subscription. Cancel your subscription first from <strong>Billing → Manage Subscription</strong> or the Stripe billing portal, then delete your account.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Contact for Manual Deletion</h2>
            <p className="text-brand-muted leading-relaxed">
              If you are unable to access your account and need your data deleted, contact <a href="mailto:privacy@aegisdms.com" className="text-brand-accent hover:underline">privacy@aegisdms.com</a>. We will verify your identity and process the deletion within 30 days.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-brand-border">
          <p className="font-sans text-xs text-brand-muted">
            Related: <Link to="/privacy" className="text-brand-accent hover:underline">Privacy Policy</Link> · <Link to="/terms" className="text-brand-accent hover:underline">Terms of Service</Link>
          </p>
        </div>
      </SketchCard>
    </MarketingShell>
  );
}
