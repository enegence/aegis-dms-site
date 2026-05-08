import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { post } from '../../lib/api';

export default function ResetPassword() {
  const navigate = useNavigate();
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

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-brand-bg">
        <div className="w-full max-w-md p-8 bg-brand-surface border-2 border-brand-border rounded-lg text-center">
          <h1 className="font-hand text-4xl font-bold mb-4 text-brand-danger">Invalid Link</h1>
          <p className="font-sans text-sm text-brand-muted mb-4">This reset link is invalid or expired.</p>
          <Link to="/forgot-password" className="font-sans text-sm text-brand-accent hover:underline">Request a new one</Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-brand-bg">
        <div className="w-full max-w-md p-8 bg-brand-surface border-2 border-brand-border rounded-lg text-center">
          <h1 className="font-hand text-4xl font-bold mb-4 text-brand-success">Password Reset</h1>
          <p className="font-sans text-sm text-brand-muted">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-brand-bg">
      <form onSubmit={handleSubmit} className="w-full max-w-md p-8 bg-brand-surface border-2 border-brand-border rounded-lg">
        <h1 className="font-hand text-4xl font-bold mb-2 text-brand-ink">New Password</h1>
        <p className="font-sans text-sm text-brand-muted mb-6">Enter your new passphrase.</p>

        <input type="password" placeholder="New passphrase (8+ characters)" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
          className="w-full font-sans text-sm p-3 mb-4 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent" />

        {error && <div className="font-sans text-sm mb-3 text-brand-danger">{error}</div>}

        <button type="submit" disabled={loading}
          className="w-full font-sans font-semibold text-sm p-3 cursor-pointer bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors disabled:opacity-50">
          {loading ? 'Resetting...' : 'Set New Password'}
        </button>
      </form>
    </div>
  );
}
