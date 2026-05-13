import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { verifyClaim } from '../../lib/api';

function ClaimCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-brand-bg">
      <div className="w-full max-w-lg p-8 bg-brand-surface border-2 border-brand-border rounded-lg">
        {children}
      </div>
    </div>
  );
}

export default function ClaimVerify() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError('');
    setLoading(true);
    try {
      await verifyClaim(token, pin || undefined);
      navigate(`/claim/${token}/accept`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('invalid_pin')) {
        setError('Incorrect verification code. Please try again.');
      } else if (msg.includes('claim_not_found')) {
        setError('This claim link is no longer valid.');
      } else if (msg.includes('too_many_attempts')) {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else {
        setError('Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <ClaimCard>
      <h1 className="font-hand text-3xl font-bold text-brand-ink mb-2">Verify Identity</h1>
      <p className="font-sans text-sm text-brand-muted mb-6">
        Please confirm your identity to proceed with this claim.
        If you were given a verification code by the person who set this up, enter it below.
        Otherwise, leave the field blank and continue.
      </p>

      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label className="block font-sans text-sm font-semibold text-brand-ink mb-1">
            Verification Code <span className="font-normal text-brand-muted">(optional)</span>
          </label>
          <input
            type="text"
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="Enter code if you have one"
            autoComplete="off"
            className="w-full font-sans text-sm p-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
          />
        </div>

        {error && (
          <div className="font-sans text-sm text-brand-danger">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full font-sans font-semibold text-sm p-3 cursor-pointer bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify and Continue'}
        </button>
      </form>
    </ClaimCard>
  );
}
