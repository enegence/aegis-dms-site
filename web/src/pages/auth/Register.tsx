import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { post } from '../../lib/api';
import { useAuth } from '../../App';

export default function Register() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await post<{ user: any }>('/api/auth/register', {
        displayName,
        email,
        password,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setUser(res.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-brand-bg">
      <form onSubmit={handleSubmit} className="w-full max-w-md p-8 bg-brand-surface border-2 border-brand-border rounded-lg">
        <h1 className="font-hand text-4xl font-bold mb-2 text-brand-ink">Create Account</h1>
        <p className="font-sans text-sm text-brand-muted mb-6">Protect your legacy with Aegis DMS.</p>

        <input type="text" placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} required
          className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent" />
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
          className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent" />
        <input type="password" placeholder="Passphrase (8+ characters)" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
          className="w-full font-sans text-sm p-3 mb-4 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent" />

        {error && <div className="font-sans text-sm mb-3 text-brand-danger">{error}</div>}

        <button type="submit" disabled={loading}
          className="w-full font-sans font-semibold text-sm p-3 cursor-pointer bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors disabled:opacity-50">
          {loading ? 'Creating...' : 'Create Account'}
        </button>

        <p className="font-sans text-sm text-brand-muted mt-4 text-center">
          Already have an account? <Link to="/login" className="text-brand-accent hover:underline">Log in</Link>
        </p>
      </form>
    </div>
  );
}
