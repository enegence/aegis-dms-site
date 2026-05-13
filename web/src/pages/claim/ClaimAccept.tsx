import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { acceptClaim } from '../../lib/api';

function ClaimCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-brand-bg">
      <div className="w-full max-w-lg p-8 bg-brand-surface border-2 border-brand-border rounded-lg">
        {children}
      </div>
    </div>
  );
}

export default function ClaimAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !accepted) return;
    setError('');
    setLoading(true);
    try {
      await acceptClaim(token);
      navigate(`/claim/${token}/download`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('claim_not_found')) {
        setError('This claim link is no longer valid or has expired.');
      } else if (msg.includes('invalid_state')) {
        setError('This step is not available yet. Please complete verification first.');
      } else if (msg.includes('too_many_attempts')) {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else {
        setError('Could not accept claim. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <ClaimCard>
      <h1 className="font-hand text-3xl font-bold text-brand-ink mb-2">Accept Responsibility</h1>
      <p className="font-sans text-sm text-brand-muted mb-6">
        Before accessing this information, you must acknowledge your role and responsibility.
      </p>

      <div className="mb-6 p-4 bg-brand-bg border border-brand-border rounded font-sans text-sm text-brand-ink space-y-3">
        <p>
          By proceeding, you acknowledge that:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>You are the intended recipient of this information.</li>
          <li>This information was prepared by someone who has named you as a trusted contact.</li>
          <li>You will handle this information with appropriate care and discretion.</li>
          <li>The encrypted packet and release key are sensitive materials related to a person's estate or legacy instructions.</li>
        </ul>
      </div>

      <form onSubmit={handleAccept} className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={accepted}
            onChange={e => setAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-brand-border accent-brand-accent"
          />
          <span className="font-sans text-sm text-brand-ink">
            I understand and accept the responsibility associated with this claim.
          </span>
        </label>

        {error && (
          <div className="font-sans text-sm text-brand-danger">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || !accepted}
          className="w-full font-sans font-semibold text-sm p-3 cursor-pointer bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors disabled:opacity-50"
        >
          {loading ? 'Accepting...' : 'Accept and Continue'}
        </button>
      </form>
    </ClaimCard>
  );
}
