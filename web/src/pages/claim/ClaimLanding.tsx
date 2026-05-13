import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getClaimStatus, openClaim, type ClaimStatus } from '../../lib/api';

const TERMINAL_STATES = new Set(['acknowledged', 'expired', 'escalated', 'failed']);

function ClaimCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-brand-bg">
      <div className="w-full max-w-lg p-8 bg-brand-surface border-2 border-brand-border rounded-lg">
        {children}
      </div>
    </div>
  );
}

function TerminalMessage({ status }: { status: string }) {
  const messages: Record<string, { title: string; body: string }> = {
    acknowledged: {
      title: 'Claim Complete',
      body: 'You have already acknowledged receipt of this claim. No further action is required.',
    },
    expired: {
      title: 'Claim Expired',
      body: 'This claim link has expired. Please contact the person who sent it to you for assistance.',
    },
    escalated: {
      title: 'Claim Escalated',
      body: 'This claim has been escalated to another contact. No action is required from you.',
    },
    failed: {
      title: 'Claim Unavailable',
      body: 'This claim is no longer available. Please contact support if you believe this is an error.',
    },
  };
  const msg = messages[status] ?? { title: 'Claim Unavailable', body: 'This claim is no longer available.' };
  return (
    <ClaimCard>
      <h1 className="font-hand text-3xl font-bold text-brand-ink mb-3">{msg.title}</h1>
      <p className="font-sans text-sm text-brand-muted">{msg.body}</p>
    </ClaimCard>
  );
}

export default function ClaimLanding() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [claim, setClaim] = useState<ClaimStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!token) return;
    getClaimStatus(token)
      .then(setClaim)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleBegin() {
    if (!token) return;
    setOpening(true);
    try {
      const updated = await openClaim(token);
      setClaim(updated);
    } catch {
      // Already opened or idempotent — proceed anyway
    } finally {
      setOpening(false);
      navigate(`/claim/${token}/verify`);
    }
  }

  if (loading) {
    return (
      <ClaimCard>
        <p className="font-sans text-sm text-brand-muted">Loading...</p>
      </ClaimCard>
    );
  }

  if (notFound || !claim) {
    return (
      <ClaimCard>
        <h1 className="font-hand text-3xl font-bold text-brand-ink mb-3">Claim Not Found</h1>
        <p className="font-sans text-sm text-brand-muted">
          This link is not valid or has expired. Please check that you used the correct link from your notification.
        </p>
      </ClaimCard>
    );
  }

  if (TERMINAL_STATES.has(claim.status)) {
    return <TerminalMessage status={claim.status} />;
  }

  const expiresAt = claim.expiresAt ? new Date(claim.expiresAt) : null;

  const STATUS_LABELS: Record<string, string> = {
    pending: 'Pending',
    notified: 'Notified',
    opened: 'Opened',
    verified: 'Verified',
    accepted: 'Accepted',
    packet_downloaded: 'Packet Downloaded',
    key_viewed: 'Key Viewed',
  };

  return (
    <ClaimCard>
      <h1 className="font-hand text-3xl font-bold text-brand-ink mb-2">You Have a Claim</h1>
      {claim.ownerDisplayName && (
        <p className="font-sans text-sm text-brand-muted mb-1">
          From: <span className="font-semibold text-brand-ink">{claim.ownerDisplayName}</span>
        </p>
      )}
      <p className="font-sans text-sm text-brand-muted mb-6">
        Someone you know has designated you to receive important information through Aegis.
        You will be guided through a short verification and acceptance process before gaining access.
      </p>

      <div className="mb-4 flex gap-4 flex-wrap font-sans text-xs text-brand-muted">
        <span>
          <span className="font-semibold text-brand-ink">Status: </span>
          {STATUS_LABELS[claim.status] ?? claim.status}
        </span>
        {expiresAt && (
          <span>
            <span className="font-semibold text-brand-ink">Expires: </span>
            {expiresAt.toLocaleString()}
          </span>
        )}
      </div>

      <div className="mb-6 p-4 bg-brand-bg border border-brand-border rounded font-sans text-sm text-brand-ink space-y-2">
        <p>
          This claim contains sensitive estate or legacy information prepared specifically for you.
          Once accepted, you will be able to download an encrypted information packet and retrieve the release key.
        </p>
        <p>
          Please proceed only if you are the intended recipient.
        </p>
      </div>

      <button
        onClick={handleBegin}
        disabled={opening}
        className="w-full font-sans font-semibold text-sm p-3 cursor-pointer bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors disabled:opacity-50"
      >
        {opening ? 'Opening...' : 'Begin Claim Process'}
      </button>
    </ClaimCard>
  );
}
