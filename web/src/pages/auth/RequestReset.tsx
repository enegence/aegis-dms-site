import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { post } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { SketchCard, InkButton } from '../../components/ui';
import { AegisLockup } from '../../components/brand';

export default function RequestReset() {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await post('/api/auth/request-reset', { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  const wrap = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: t.bg }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <SketchCard style={{ padding: '32px 30px' }}>{children}</SketchCard>
      </div>
    </div>
  );

  if (sent) {
    return wrap(
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}><AegisLockup size="sm" color={t.ink} /></div>
        <h1 style={{ fontFamily: "'Caveat',cursive", fontSize: 36, fontWeight: 700, color: t.ink, margin: '0 0 12px' }}>Check Your Email</h1>
        <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, marginBottom: 16, lineHeight: 1.7 }}>
          If an account exists with that email, we sent a password reset link.
        </p>
        <Link to="/login" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.accent, textDecoration: 'none' }}>Back to login</Link>
      </div>
    );
  }

  const inputStyle: CSSProperties = {
    width: '100%', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, padding: '10px 12px',
    marginBottom: 16, background: t.bg, border: `1.5px solid ${t.border}`, borderRadius: 4, color: t.ink,
    boxSizing: 'border-box', outline: 'none',
  };

  return wrap(
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 18 }}><AegisLockup size="sm" color={t.ink} /></div>
      <h1 style={{ fontFamily: "'Caveat',cursive", fontSize: 36, fontWeight: 700, color: t.ink, margin: '0 0 4px' }}>Reset Password</h1>
      <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, marginBottom: 22 }}>Enter your email to receive a reset link.</p>

      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />

      {error && <div role="alert" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginBottom: 12, color: t.danger }}>{error}</div>}

      <InkButton type="submit" disabled={loading} ariaBusy={loading} style={{ width: '100%' }}>
        {loading ? 'Sending...' : 'Send Reset Link'}
      </InkButton>

      <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, marginTop: 16, textAlign: 'center' }}>
        <Link to="/login" style={{ color: t.accent, textDecoration: 'none' }}>Back to login</Link>
      </p>
    </form>
  );
}
