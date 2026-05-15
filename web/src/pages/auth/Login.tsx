import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { post } from '../../lib/api';
import { useAuth } from '../../App';

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
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

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-brand-bg">
      {/* aria-live region for async status */}
      <div aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        {loading ? 'Logging in…' : ''}
      </div>

      <form onSubmit={handleSubmit} aria-label="Login form" className="w-full max-w-md p-8 bg-brand-surface border-2 border-brand-border rounded-lg">
        <h1 className="font-hand text-4xl font-bold mb-2 text-brand-ink">Welcome Back</h1>
        <p className="font-sans text-sm text-brand-muted mb-6">Log in to your Aegis account.</p>

        <div className="mb-3">
          <label htmlFor="login-email" className="block font-sans text-xs text-brand-muted mb-1">Email address</label>
          <input id="login-email" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required aria-required="true"
            aria-describedby={error ? 'login-error' : undefined}
            className="w-full font-sans text-sm p-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent focus-visible:ring-2 focus-visible:ring-brand-accent" />
        </div>

        <div className="mb-4">
          <label htmlFor="login-password" className="block font-sans text-xs text-brand-muted mb-1">Passphrase</label>
          <input id="login-password" type="password" placeholder="Passphrase" value={password} onChange={e => setPassword(e.target.value)} required aria-required="true"
            aria-describedby={error ? 'login-error' : undefined}
            className="w-full font-sans text-sm p-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent focus-visible:ring-2 focus-visible:ring-brand-accent" />
        </div>

        {error && (
          <div id="login-error" role="alert" aria-live="assertive" className="font-sans text-sm mb-3 text-brand-danger">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} aria-busy={loading}
          className="w-full font-sans font-semibold text-sm p-3 cursor-pointer bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2">
          {loading ? 'Logging in...' : 'Log In'}
        </button>

        <div className="flex justify-between font-sans text-sm text-brand-muted mt-4">
          <Link to="/register" className="text-brand-accent hover:underline">Create account</Link>
          <Link to="/forgot-password" className="text-brand-accent hover:underline">Forgot password?</Link>
        </div>
      </form>
    </div>
  );
}
