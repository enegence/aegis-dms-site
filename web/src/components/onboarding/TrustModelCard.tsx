import { useState } from 'react';
import { acknowledgeHostedTrust } from '../../lib/api';

interface TrustModelCardProps {
  /** Called after the user successfully records their acknowledgement. */
  onAcknowledged: () => void;
  /** Whether the user has already acknowledged — shows a "done" state. */
  alreadyAcknowledged?: boolean;
}

/**
 * TrustModelCard — displays the required Hosted trust model disclosure and
 * records a versioned acknowledgement (hosted-v1) in trust_acknowledgements.
 *
 * Required copy is specified in Phase 4 Task 2. The acknowledgement is
 * persisted server-side via POST /api/onboarding/trust-acknowledge.
 */
export default function TrustModelCard({ onAcknowledged, alreadyAcknowledged = false }: TrustModelCardProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(alreadyAcknowledged);

  const handleAcknowledge = async () => {
    setSaving(true);
    setError('');
    try {
      await acknowledgeHostedTrust();
      setDone(true);
      onAcknowledged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to record acknowledgement. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">
          {done ? (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold">
              ✓
            </span>
          ) : (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-brand-accent text-brand-accent text-xs font-bold">
              !
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-sans text-sm font-semibold text-brand-ink">
            Hosted trust model acknowledgement
          </h3>
          <p className="font-sans text-xs text-brand-muted mt-0.5">
            Version: hosted-v1
          </p>
        </div>
      </div>

      {/* Required disclosure copy — do not alter */}
      <div className="rounded-lg bg-brand-bg border border-brand-border p-4">
        <p className="font-sans text-sm text-brand-ink leading-relaxed">
          Aegis Hosted is a managed service. Aegis SaaS stores and processes your encrypted legacy
          packet and executes release workflows under your configured policy. This is different from
          self-hosting.
        </p>
      </div>

      {error && (
        <p className="font-sans text-xs text-brand-danger">{error}</p>
      )}

      {done ? (
        <div className="flex items-center gap-2">
          <span className="font-sans text-xs text-green-700 font-medium">
            Acknowledged
          </span>
          <span className="font-sans text-xs text-brand-muted">
            — you can continue to the next step.
          </span>
        </div>
      ) : (
        <button
          onClick={handleAcknowledge}
          disabled={saving}
          className="w-full py-2 px-4 bg-brand-accent text-white rounded-lg font-sans text-sm font-semibold
                     hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Recording acknowledgement…' : 'I understand — accept and continue'}
        </button>
      )}
    </div>
  );
}
