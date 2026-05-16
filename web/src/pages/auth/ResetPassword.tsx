import { useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { post } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { SketchCard, InkButton } from '../../components/ui';
import { AegisLockup } from '../../components/brand';

export default function ResetPassword() {
  const navigate = useNavigate();
  const t = useTheme();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await post('/api/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
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

  if (!token) {
    return wrap(
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Caveat',cursive", fontSize: 36, fontWeight: 700, color: t.danger, margin: '0 0 12px' }}>Invalid Link</h1>
        <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, marginBottom: 16 }}>This reset link is invalid or expired.</p>
        <Link to="/forgot-password" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.accent, textDecoration: 'none' }}>Request a new one</Link>
      </div>
    );
  }

  if (success) {
    return wrap(
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Caveat',cursive", fontSize: 36, fontWeight: 700, color: t.accent, margin: '0 0 12px' }}>Password Reset</h1>
        <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted }}>Redirecting to login...</p>
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
      <h1 style={{ fontFamily: "'Caveat',cursive", fontSize: 36, fontWeight: 700, color: t.ink, margin: '0 0 4px' }}>New Password</h1>
      <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted, marginBottom: 22 }}>Enter your new passphrase.</p>

      <input type="password" placeholder="New passphrase (8+ characters)" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} style={inputStyle} />

      {error && <div role="alert" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginBottom: 12, color: t.danger }}>{error}</div>}

      <InkButton type="submit" disabled={loading} ariaBusy={loading} style={{ width: '100%' }}>
        {loading ? 'Resetting...' : 'Set New Password'}
      </InkButton>
    </form>
  );
}
