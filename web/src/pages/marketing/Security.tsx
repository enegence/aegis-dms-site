import { Link } from 'react-router-dom';

export default function Security() {
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
        <div className="mb-8 p-4 bg-brand-surface border border-brand-border rounded-lg">
          <p className="font-sans text-xs text-brand-muted">
            <strong>Alpha notice:</strong> Aegis has not undergone an independent security audit. The security practices described here reflect our design intent. We plan to commission a third-party audit before general availability. Do not rely on Aegis for threat models requiring certified security assurances.
          </p>
        </div>

        <h1 className="font-hand text-5xl font-bold text-brand-ink mb-2">Security</h1>
        <p className="font-sans text-xs text-brand-muted mb-10">Last updated: May 2026</p>

        <div className="space-y-8 font-sans text-sm text-brand-ink">

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Encryption at Rest</h2>
            <p className="text-brand-muted leading-relaxed mb-3">
              All PII fields (names, emails, phone numbers, account descriptions, location notes, executor notes) are encrypted at rest using AES-256-GCM. Each sensitive field has its own encrypted envelope. Category and title fields remain plaintext for filtering purposes.
            </p>
            <p className="text-brand-muted leading-relaxed">
              Passwords are hashed with Argon2id (memory-hard, timing-safe). Password hashes are never exposed in API responses or logs.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Encryption in Transit</h2>
            <p className="text-brand-muted leading-relaxed">
              All communications use HTTPS/TLS. Cookies are set with HttpOnly, Secure (in production), and SameSite=Lax flags. API keys and session tokens are never passed in URL query strings.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">CSRF and Session Security</h2>
            <p className="text-brand-muted leading-relaxed">
              All state-changing requests require a CSRF token (X-CSRF-Token header). Sessions use cryptographically random identifiers stored in HttpOnly cookies. Sessions expire after 7 days. Rate limiting is applied to authentication endpoints.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Trust Models</h2>
            <div className="space-y-4">
              <div className="p-4 bg-brand-surface border border-brand-border rounded">
                <h3 className="font-sans font-semibold text-brand-ink mb-1">Aegis Core (Self-Hosted)</h3>
                <p className="text-brand-muted text-xs">
                  Your data stays on your infrastructure. You control the encryption keys. No data leaves your host unless you enable Relay services. Trust model: you trust yourself and your hosting environment.
                </p>
              </div>
              <div className="p-4 bg-brand-surface border border-brand-border rounded">
                <h3 className="font-sans font-semibold text-brand-ink mb-1">Aegis Relay Monitoring</h3>
                <p className="text-brand-muted text-xs">
                  Aegis monitors your heartbeat and alerts your contacts if you go offline. No estate release material is held by Aegis. Trust model: you trust Aegis to accurately detect offline status and notify contacts.
                </p>
              </div>
              <div className="p-4 bg-brand-surface border border-brand-border rounded">
                <h3 className="font-sans font-semibold text-brand-ink mb-1">Aegis Relay Escrow</h3>
                <p className="text-brand-muted text-xs">
                  Aegis holds encrypted release material. In an offline/incapacity scenario, Aegis can execute the release on your behalf. Trust model: you trust Aegis to hold and release material responsibly. Explicit acknowledgement required before enabling.
                </p>
              </div>
              <div className="p-4 bg-brand-surface border border-brand-border rounded">
                <h3 className="font-sans font-semibold text-brand-ink mb-1">Aegis Hosted</h3>
                <p className="text-brand-muted text-xs">
                  Fully managed. Aegis stores your encrypted estate data and manages the release process. Trust model: you trust Aegis as a service provider, similar to trusting a cloud storage provider.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Audit Logging</h2>
            <p className="text-brand-muted leading-relaxed">
              Security-relevant events are logged with redacted payloads. Audit logs never contain plaintext PII, contact names, emails, phone numbers, or estate item content. Logs are structured and retained for operational security review.
            </p>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Alpha Limitations</h2>
            <ul className="list-disc list-inside space-y-2 text-brand-muted">
              <li>No independent third-party security audit has been performed</li>
              <li>No Shamir Secret Sharing or multi-party key management</li>
              <li>No "zero knowledge" architecture — Aegis can decrypt hosted data with server-managed keys</li>
              <li>No formal penetration testing</li>
            </ul>
          </section>

          <section>
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-3">Vulnerability Reporting</h2>
            <p className="text-brand-muted leading-relaxed">
              Report security issues to <a href="mailto:security@aegisdms.com" className="text-brand-accent hover:underline">security@aegisdms.com</a>. Please do not disclose vulnerabilities publicly until we have had the opportunity to address them.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-brand-border">
          <p className="font-sans text-xs text-brand-muted">
            Related: <Link to="/terms" className="text-brand-accent hover:underline">Terms of Service</Link> · <Link to="/privacy" className="text-brand-accent hover:underline">Privacy Policy</Link> · <Link to="/disclaimers" className="text-brand-accent hover:underline">Disclaimers</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
