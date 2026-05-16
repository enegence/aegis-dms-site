import { useState, type CSSProperties } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { post } from '../../lib/api';
import { useAuth } from '../../App';
import { useTheme } from '../../lib/theme';
import { SketchCard, InkButton } from '../../components/ui';
import { AegisLockup } from '../../components/brand';

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await post<{ user: any }>('/api/auth/login', { email, password });
      setUser(res.user);
      navigate('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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
        {loading ? 'Logging in…' : ''}
      </div>

      <svg style={{ position: 'absolute', top: 24, left: 24, opacity: 0.15 }} width="80" height="80" viewBox="0 0 80 80" fill="none">
        <path d="M4 76 L4 4 L76 4" stroke={t.ink} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <circle cx="4" cy="4" r="4" fill={t.ink} />
      </svg>
      <svg style={{ position: 'absolute', bottom: 24, right: 24, opacity: 0.15, transform: 'rotate(180deg)' }} width="80" height="80" viewBox="0 0 80 80" fill="none">
        <path d="M4 76 L4 4 L76 4" stroke={t.ink} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <circle cx="4" cy="4" r="4" fill={t.ink} />
      </svg>

      <form onSubmit={handleSubmit} aria-label="Login form" style={{ width: '100%', maxWidth: 420 }}>
        <SketchCard style={{ padding: '32px 30px' }}>
          <div style={{ marginBottom: 18 }}>
            <AegisLockup size="sm" color={t.ink} />
          </div>
          <h1 style={{ fontFamily: "'Caveat',cursive", fontSize: 36, fontWeight: 700, color: t.ink, margin: '0 0 4px' }}>Welcome Back</h1>
          <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, marginBottom: 22 }}>Log in to your Aegis account.</p>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="login-email" style={labelStyle}>Email address</label>
            <input id="login-email" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required aria-required="true"
              aria-describedby={error ? 'login-error' : undefined} style={inputStyle} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="login-password" style={labelStyle}>Passphrase</label>
            <input id="login-password" type="password" placeholder="Passphrase" value={password} onChange={e => setPassword(e.target.value)} required aria-required="true"
              aria-describedby={error ? 'login-error' : undefined} style={inputStyle} />
          </div>

          {error && (
            <div id="login-error" role="alert" aria-live="assertive" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginBottom: 12, color: t.danger }}>
              {error}
            </div>
          )}

          <InkButton type="submit" disabled={loading} ariaBusy={loading} style={{ width: '100%' }}>
            {loading ? 'Logging in...' : 'Log In'}
          </InkButton>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, marginTop: 16 }}>
            <Link to="/register" style={{ color: t.accent, textDecoration: 'none' }}>Create account</Link>
            <Link to="/forgot-password" style={{ color: t.accent, textDecoration: 'none' }}>Forgot password?</Link>
          </div>
        </SketchCard>
      </form>
    </div>
  );
}
