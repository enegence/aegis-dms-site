import { Link } from 'react-router-dom';
import MarketingShell from '../../components/marketing/MarketingShell';
import { SketchCard } from '../../components/ui';

export default function AcceptableUse() {
  return (
    <MarketingShell>
      <SketchCard style={{ padding: '32px 28px' }}>
        <h1 className="font-hand text-5xl font-bold text-brand-ink mb-2">Acceptable Use Policy</h1>
        <p className="font-sans text-xs text-brand-muted mb-10">Last updated: May 2026 (draft)</p>

        <div className="space-y-8 font-sans text-sm text-brand-ink">

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Purpose of Aegis</h2>
            <p className="text-brand-muted leading-relaxed">
              Aegis is designed to help individuals organize and deliver estate information — account locations, instructions, and contact details — to trusted recipients after death or incapacitation. Use of Aegis must be consistent with this purpose.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">You Must Not Store</h2>
            <ul className="list-disc list-inside space-y-2 text-brand-muted">
              <li>Passwords, passphrases, or login credentials for any account</li>
              <li>Private keys, seed phrases, or cryptocurrency wallet recovery information</li>
              <li>Illegal content of any kind</li>
              <li>Content that violates the privacy or rights of others</li>
              <li>Content designed to harm, defraud, or deceive your designated contacts</li>
              <li>Material that would expose Aegis or its infrastructure to legal liability</li>
            </ul>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Why No Credentials or Seed Phrases</h2>
            <p className="text-brand-muted leading-relaxed">
              Aegis stores estate metadata and instructions — descriptions of where things are, who to contact, and what to do. It is not a password manager or a secure vault for authentication secrets. Storing live credentials in Aegis creates unnecessary risk: if your Aegis account were ever compromised, so would all stored credentials. Use a dedicated password manager instead, and store only the location or instructions for accessing it.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Contact Consent</h2>
            <p className="text-brand-muted leading-relaxed">
              You must only designate contacts who have agreed (or would reasonably agree) to receive estate communications on your behalf. Do not use Aegis to send unsolicited messages.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Enforcement</h2>
            <p className="text-brand-muted leading-relaxed">
              Violation of this policy may result in account suspension or termination without notice. We reserve the right to take action to protect the integrity of the platform and its users.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-brand-border">
          <p className="font-sans text-xs text-brand-muted">
            Related: <Link to="/terms" className="text-brand-accent hover:underline">Terms of Service</Link> · <Link to="/disclaimers" className="text-brand-accent hover:underline">Disclaimers</Link>
          </p>
        </div>
      </SketchCard>
    </MarketingShell>
  );
}
