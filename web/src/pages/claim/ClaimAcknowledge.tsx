import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { acknowledgeClaimToken } from '../../lib/api';
import ClaimShell from '../../components/claim/ClaimShell';

const ClaimCard = ClaimShell;

export default function ClaimAcknowledge() {
  const { token } = useParams<{ token: string }>();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleAcknowledge(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !confirmed) return;
    setError('');
    setLoading(true);
    try {
      await acknowledgeClaimToken(token);
      setDone(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('claim_not_found')) {
        setError('This claim link is no longer valid or has expired.');
      } else if (msg.includes('too_many_attempts')) {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else {
        setError('Could not submit acknowledgement. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <ClaimCard>
        <div className="text-center">
          <h1 className="font-hand text-3xl font-bold text-brand-ink mb-3">Claim Complete</h1>
          <p className="font-sans text-sm text-brand-muted mb-6">
            You have successfully acknowledged receipt of this claim. This process is now complete.
          </p>
          <div className="p-4 bg-brand-bg border border-brand-border rounded font-sans text-sm text-brand-ink">
            <p>
              Please ensure you have saved the release key and packet file in a secure location.
              Your acknowledgement has been recorded.
            </p>
          </div>
        </div>
      </ClaimCard>
    );
  }

  return (
    <ClaimCard>
      <h1 className="font-hand text-3xl font-bold text-brand-ink mb-2">Final Acknowledgement</h1>
      <p className="font-sans text-sm text-brand-muted mb-6">
        Please confirm that you have received and saved the information from this claim.
      </p>

      <div className="mb-6 p-4 bg-brand-bg border border-brand-border rounded font-sans text-sm text-brand-ink space-y-2">
        <p>By submitting this acknowledgement you confirm that:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>You have downloaded and saved the encrypted packet.</li>
          <li>You have saved the release key in a secure location.</li>
          <li>You understand this link will no longer be active after acknowledgement.</li>
        </ul>
      </div>

      <form onSubmit={handleAcknowledge} className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-brand-border accent-brand-accent"
          />
          <span className="font-sans text-sm text-brand-ink">
            I confirm that I have received and saved all materials from this claim.
          </span>
        </label>

        {error && (
          <div className="font-sans text-sm text-brand-danger">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || !confirmed}
          className="w-full font-sans font-semibold text-sm p-3 cursor-pointer bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Acknowledgement'}
        </button>
      </form>
    </ClaimCard>
  );
}
