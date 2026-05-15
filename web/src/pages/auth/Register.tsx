import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { post } from '../../lib/api';
import { useAuth } from '../../App';

const TERMS_VERSION = 'terms-v1';

export default function Register() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!termsAccepted) {
      setError('You must accept the Terms, Privacy Policy, and Disclaimers to continue.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await post<{ user: any }>('/api/auth/register', {
        displayName,
        email,
        password,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        termsVersion: TERMS_VERSION,
      });
      setUser(res.user);
      navigate('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-brand-bg">
      {/* aria-live region for async status */}
      <div aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        {loading ? 'Creating your account…' : ''}
      </div>

      <form onSubmit={handleSubmit} aria-label="Create account form" className="w-full max-w-md p-8 bg-brand-surface border-2 border-brand-border rounded-lg">
        <h1 className="font-hand text-4xl font-bold mb-2 text-brand-ink">Create Account</h1>
        <p className="font-sans text-sm text-brand-muted mb-6">Protect your legacy with Aegis DMS.</p>

        <div className="mb-3">
          <label htmlFor="reg-displayName" className="block font-sans text-xs text-brand-muted mb-1">Your name</label>
          <input id="reg-displayName" type="text" placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} required aria-required="true"
            className="w-full font-sans text-sm p-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent focus-visible:ring-2 focus-visible:ring-brand-accent" />
        </div>

        <div className="mb-3">
          <label htmlFor="reg-email" className="block font-sans text-xs text-brand-muted mb-1">Email address</label>
          <input id="reg-email" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required aria-required="true"
            className="w-full font-sans text-sm p-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent focus-visible:ring-2 focus-visible:ring-brand-accent" />
        </div>

        <div className="mb-4">
          <label htmlFor="reg-password" className="block font-sans text-xs text-brand-muted mb-1">Passphrase (8+ characters)</label>
          <input id="reg-password" type="password" placeholder="Passphrase (8+ characters)" value={password} onChange={e => setPassword(e.target.value)} required aria-required="true" minLength={8}
            className="w-full font-sans text-sm p-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent focus-visible:ring-2 focus-visible:ring-brand-accent" />
        </div>

        <label htmlFor="reg-terms" className="flex items-start gap-3 mb-4 cursor-pointer">
          <input
            id="reg-terms"
            type="checkbox"
            checked={termsAccepted}
            onChange={e => setTermsAccepted(e.target.checked)}
            aria-required="true"
            aria-describedby={error && !termsAccepted ? 'reg-error' : undefined}
            className="mt-0.5 h-4 w-4 rounded border border-brand-border accent-brand-accent"
          />
          <span className="font-sans text-xs text-brand-muted leading-relaxed">
            I agree to the{' '}
            <Link to="/terms" target="_blank" className="text-brand-accent hover:underline">Terms of Service</Link>,{' '}
            <Link to="/privacy" target="_blank" className="text-brand-accent hover:underline">Privacy Policy</Link>, and{' '}
            <Link to="/disclaimers" target="_blank" className="text-brand-accent hover:underline">Disclaimers</Link>.
            I understand Aegis is not a will and does not guarantee asset transfer.
          </span>
        </label>

        {error && (
          <div id="reg-error" role="alert" aria-live="assertive" className="font-sans text-sm mb-3 text-brand-danger">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading || !termsAccepted} aria-busy={loading}
          className="w-full font-sans font-semibold text-sm p-3 cursor-pointer bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2">
          {loading ? 'Creating...' : 'Create Account'}
        </button>

        <p className="font-sans text-sm text-brand-muted mt-4 text-center">
          Already have an account? <Link to="/login" className="text-brand-accent hover:underline">Log in</Link>
        </p>
      </form>
    </div>
  );
}
