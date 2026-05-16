import { useState, type CSSProperties } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { post } from '../../lib/api';
import { useAuth } from '../../App';
import { useTheme } from '../../lib/theme';
import { SketchCard, InkButton } from '../../components/ui';
import { AegisLockup } from '../../components/brand';

const TERMS_VERSION = 'terms-v1';

export default function Register() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const t = useTheme();
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

  const inputStyle: CSSProperties = {
    width: '100%', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, padding: '10px 12px',
    background: t.bg, border: `1.5px solid ${t.border}`, borderRadius: 4, color: t.ink,
    boxSizing: 'border-box', outline: 'none',
  };
  const labelStyle: CSSProperties = {
    display: 'block', fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
    color: t.muted, letterSpacing: '0.06em', marginBottom: 4,
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: t.bg, position: 'relative' }}>
      {/* aria-live region for async status */}
      <div aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        {loading ? 'Creating your account…' : ''}
      </div>

      <svg style={{ position: 'absolute', top: 24, left: 24, opacity: 0.15 }} width="80" height="80" viewBox="0 0 80 80" fill="none">
        <path d="M4 76 L4 4 L76 4" stroke={t.ink} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <circle cx="4" cy="4" r="4" fill={t.ink} />
      </svg>
      <svg style={{ position: 'absolute', bottom: 24, right: 24, opacity: 0.15, transform: 'rotate(180deg)' }} width="80" height="80" viewBox="0 0 80 80" fill="none">
        <path d="M4 76 L4 4 L76 4" stroke={t.ink} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <circle cx="4" cy="4" r="4" fill={t.ink} />
      </svg>

      <form onSubmit={handleSubmit} aria-label="Create account form" style={{ width: '100%', maxWidth: 440 }}>
        <SketchCard style={{ padding: '32px 30px' }}>
          <div style={{ marginBottom: 18 }}>
            <AegisLockup size="sm" color={t.ink} />
          </div>
          <h1 style={{ fontFamily: "'Caveat',cursive", fontSize: 36, fontWeight: 700, color: t.ink, margin: '0 0 4px' }}>Create Account</h1>
          <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, marginBottom: 22 }}>Protect your legacy with Aegis DMS.</p>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="reg-displayName" style={labelStyle}>Your name</label>
            <input id="reg-displayName" type="text" placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} required aria-required="true" style={inputStyle} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="reg-email" style={labelStyle}>Email address</label>
            <input id="reg-email" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required aria-required="true" style={inputStyle} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="reg-password" style={labelStyle}>Passphrase (8+ characters)</label>
            <input id="reg-password" type="password" placeholder="Passphrase (8+ characters)" value={password} onChange={e => setPassword(e.target.value)} required aria-required="true" minLength={8} style={inputStyle} />
          </div>

          <label htmlFor="reg-terms" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
            <input
              id="reg-terms"
              type="checkbox"
              checked={termsAccepted}
              onChange={e => setTermsAccepted(e.target.checked)}
              aria-required="true"
              aria-describedby={error && !termsAccepted ? 'reg-error' : undefined}
              style={{ marginTop: 2, width: 16, height: 16, accentColor: t.accent }}
            />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, lineHeight: 1.6 }}>
              I agree to the{' '}
              <Link to="/terms" target="_blank" style={{ color: t.accent }}>Terms of Service</Link>,{' '}
              <Link to="/privacy" target="_blank" style={{ color: t.accent }}>Privacy Policy</Link>, and{' '}
              <Link to="/disclaimers" target="_blank" style={{ color: t.accent }}>Disclaimers</Link>.
              I understand Aegis is not a will and does not guarantee asset transfer.
            </span>
          </label>

          {error && (
            <div id="reg-error" role="alert" aria-live="assertive" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginBottom: 12, color: t.danger }}>
              {error}
            </div>
          )}

          <InkButton type="submit" disabled={loading || !termsAccepted} ariaBusy={loading} style={{ width: '100%' }}>
            {loading ? 'Creating...' : 'Create Account'}
          </InkButton>

          <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, marginTop: 16, textAlign: 'center' }}>
            Already have an account? <Link to="/login" style={{ color: t.accent, textDecoration: 'none' }}>Log in</Link>
          </p>
        </SketchCard>
      </form>
    </div>
  );
}
