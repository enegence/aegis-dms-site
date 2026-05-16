import { Link } from 'react-router-dom';
import MarketingShell from '../../components/marketing/MarketingShell';
import { SketchCard } from '../../components/ui';

export default function Terms() {
  return (
    <MarketingShell>
      <SketchCard style={{ padding: '32px 28px' }}>
        <div className="mb-8 p-4 bg-brand-surface border border-brand-border rounded-lg">
          <p className="font-sans text-xs text-brand-muted">
            <strong>Beta notice:</strong> Aegis is currently in alpha/beta. These Terms are a working draft and have not been reviewed by legal counsel. They will be updated before general availability. By using Aegis, you acknowledge this is pre-release software.
          </p>
        </div>

        <h1 className="font-hand text-5xl font-bold text-brand-ink mb-2">Terms of Service</h1>
        <p className="font-sans text-xs text-brand-muted mb-10">Last updated: May 2026 (draft)</p>

        <div className="space-y-8 font-sans text-sm text-brand-ink">

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">1. What Aegis Is</h2>
            <p className="text-brand-muted leading-relaxed">
              Aegis DMS is a digital legacy management platform that helps you organize and deliver estate information to designated contacts after you pass away or become incapacitated. Aegis stores estate metadata, instructions, and contact information. It does not store credentials, seed phrases, or legal documents on your behalf.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">2. Aegis Is Not a Legal Instrument</h2>
            <p className="text-brand-muted leading-relaxed">
              Aegis is not a will, trust, power of attorney, or any form of legal document. It does not replace estate planning with a qualified attorney. Instructions stored in Aegis have no legal force and do not guarantee the transfer of assets. You are responsible for maintaining legally valid estate planning documents through appropriate legal channels.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">3. No Legal or Financial Advice</h2>
            <p className="text-brand-muted leading-relaxed">
              Nothing in the Aegis platform or its documentation constitutes legal, financial, tax, or professional advice of any kind. Consult qualified professionals for your specific estate planning needs.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">4. Your Responsibilities</h2>
            <ul className="list-disc list-inside space-y-2 text-brand-muted">
              <li>You are responsible for the accuracy of information you store in Aegis.</li>
              <li>You must not store passwords, private keys, seed phrases, or credentials in Aegis estate items.</li>
              <li>You must not store illegal content or content that violates our <Link to="/acceptable-use" className="text-brand-accent hover:underline">Acceptable Use Policy</Link>.</li>
              <li>You are responsible for keeping your account credentials secure.</li>
              <li>You must ensure that contacts you designate have consented to receiving estate communications.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">5. Hosted and Relay Services</h2>
            <p className="text-brand-muted leading-relaxed mb-3">
              Aegis Hosted is a fully managed service where Aegis handles the automated release of your estate package. This requires placing trust in Aegis as a service provider. Aegis Relay Escrow allows Aegis to hold encrypted release material on your behalf, to be released in offline or incapacity scenarios.
            </p>
            <p className="text-brand-muted leading-relaxed">
              Enabling Relay Escrow or Hosted release flows requires explicit acknowledgement of the trust model involved. See our <Link to="/security" className="text-brand-accent hover:underline">Security page</Link> for details on how data is protected.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">6. Payments</h2>
            <p className="text-brand-muted leading-relaxed">
              Subscription billing is handled by Stripe. Aegis does not store your payment card details. By subscribing, you agree to Stripe's terms of service. All prices are indicative during alpha and subject to change.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">7. Data and Deletion</h2>
            <p className="text-brand-muted leading-relaxed">
              You may export or delete your account data at any time. See our <Link to="/data-deletion" className="text-brand-accent hover:underline">Data Deletion</Link> and <Link to="/privacy" className="text-brand-accent hover:underline">Privacy Policy</Link> for details.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">8. Limitation of Liability</h2>
            <p className="text-brand-muted leading-relaxed">
              Aegis is provided "as is" without warranty of any kind. We do not guarantee the delivery of estate packages, the availability of the service, or the accuracy of automated release triggers. To the maximum extent permitted by law, Aegis and its operators shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">9. Changes to Terms</h2>
            <p className="text-brand-muted leading-relaxed">
              We may update these Terms. Material changes will be communicated by email. Continued use after notification constitutes acceptance of the updated Terms.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-brand-border">
          <p className="font-sans text-xs text-brand-muted">
            Related: <Link to="/privacy" className="text-brand-accent hover:underline">Privacy Policy</Link> · <Link to="/security" className="text-brand-accent hover:underline">Security</Link> · <Link to="/acceptable-use" className="text-brand-accent hover:underline">Acceptable Use</Link> · <Link to="/disclaimers" className="text-brand-accent hover:underline">Disclaimers</Link> · <Link to="/data-deletion" className="text-brand-accent hover:underline">Data Deletion</Link>
          </p>
        </div>
      </SketchCard>
    </MarketingShell>
  );
}
