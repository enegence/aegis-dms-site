import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post } from '../../lib/api';

interface PacketMeta {
  id: string;
  switchId: string | null;
  version: number;
  contentHash: string;
  storageProvider: string | null;
  storageBucket: string | null;
  lastVerifiedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface ReleaseRun {
  id: string;
  source: string;
  status: string;
  triggeringSwitchId: string | null;
  relayConnectionId: string | null;
  startedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

function statusColor(status: string) {
  if (status === 'active') return 'text-brand-accent';
  if (status === 'completed') return 'text-green-600';
  if (status === 'failed') return 'text-brand-danger';
  return 'text-brand-muted';
}

export default function Release() {
  const [packets, setPackets] = useState<PacketMeta[]>([]);
  const [runs, setRuns] = useState<ReleaseRun[]>([]);
  const [error, setError] = useState('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  function load() {
    Promise.all([
      get<{ packets: PacketMeta[] }>('/api/app/packets'),
      get<{ releaseRuns: ReleaseRun[] }>('/api/app/release-runs'),
    ])
      .then(([pd, rd]) => {
        setPackets(pd.packets);
        setRuns(rd.releaseRuns);
      })
      .catch((e: Error) => setError(e.message));
  }

  useEffect(() => { load(); }, []);

  async function verifyPacket(id: string) {
    setVerifyingId(id);
    setActionMsg('');
    try {
      const res = await post<{ verified: boolean }>(`/api/app/packets/${id}/verify`, {});
      setActionMsg(res.verified ? 'Packet verified in storage.' : 'Packet not found in storage.');
      load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : 'Verification failed.');
    } finally {
      setVerifyingId(null);
    }
  }

  async function cancelRun(id: string) {
    if (!confirm('Cancel this release run?')) return;
    setCancellingId(id);
    setActionMsg('');
    try {
      await post(`/api/app/release-runs/${id}/cancel`, {});
      setActionMsg('Release run cancelled.');
      load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : 'Cancel failed.');
    } finally {
      setCancellingId(null);
    }
  }

  if (error) return <div className="p-8 text-brand-danger font-sans">{error}</div>;

  const activeRuns = runs.filter(r => !['completed', 'cancelled', 'failed'].includes(r.status));
  const pastRuns = runs.filter(r => ['completed', 'cancelled', 'failed'].includes(r.status));

  return (
    <div className="min-h-screen bg-brand-bg p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-hand text-4xl font-bold mb-1 text-brand-ink">Release Status</h1>
        <p className="font-sans text-sm text-brand-muted mb-6">
          Packets, release runs, and cascade status.
        </p>

        {actionMsg && (
          <div className="mb-4 p-3 bg-brand-surface border border-brand-border rounded text-brand-ink font-sans text-sm">
            {actionMsg}
          </div>
        )}

        {/* Active release runs */}
        <section className="mb-8">
          <h2 className="font-hand text-2xl font-bold mb-3 text-brand-ink">Active Releases</h2>
          {activeRuns.length === 0 ? (
            <div className="p-4 bg-brand-surface border border-brand-border rounded text-brand-muted font-sans text-sm">
              No active release runs.
            </div>
          ) : (
            <div className="space-y-3">
              {activeRuns.map(r => (
                <div key={r.id} className="p-4 bg-brand-surface border border-brand-border rounded-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className={`font-sans font-semibold text-sm ${statusColor(r.status)}`}>
                        {r.status.toUpperCase()}
                      </div>
                      <div className="font-sans text-xs text-brand-muted mt-1">
                        Source: {r.source}
                        {r.triggeringSwitchId && ` · switch ${r.triggeringSwitchId.slice(0, 8)}`}
                        {r.relayConnectionId && ` · relay ${r.relayConnectionId.slice(0, 8)}`}
                      </div>
                      <div className="font-sans text-xs text-brand-muted">
                        Started: {new Date(r.startedAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => cancelRun(r.id)}
                      disabled={cancellingId === r.id}
                      className="px-3 py-1 border border-brand-danger text-brand-danger rounded font-sans text-xs hover:bg-brand-danger/10 disabled:opacity-50"
                    >
                      {cancellingId === r.id ? 'Cancelling...' : 'Cancel'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Packets */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-hand text-2xl font-bold text-brand-ink">Packets</h2>
            <Link
              to="/switches"
              className="font-sans text-xs text-brand-accent hover:underline"
            >
              Generate via switch &rarr;
            </Link>
          </div>
          {packets.length === 0 ? (
            <div className="p-4 bg-brand-surface border border-brand-border rounded text-brand-muted font-sans text-sm">
              No packets. <Link to="/switches" className="text-brand-accent hover:underline">Generate one from a switch.</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {packets.map(p => (
                <div key={p.id} className="p-4 bg-brand-surface border border-brand-border rounded-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-sans text-sm font-semibold text-brand-ink">
                        v{p.version}
                        {p.switchId && <span className="ml-2 font-normal text-brand-muted">switch {p.switchId.slice(0, 8)}</span>}
                      </div>
                      <div className="font-sans text-xs text-brand-muted mt-1">
                        Created: {new Date(p.createdAt).toLocaleDateString()}
                        {p.storageProvider && ` · storage: ${p.storageProvider}`}
                      </div>
                      {p.lastVerifiedAt && (
                        <div className="font-sans text-xs text-green-600">
                          Verified: {new Date(p.lastVerifiedAt).toLocaleString()}
                        </div>
                      )}
                      {!p.lastVerifiedAt && p.storageBucket && (
                        <div className="font-sans text-xs text-brand-muted">Not yet verified</div>
                      )}
                    </div>
                    <button
                      onClick={() => verifyPacket(p.id)}
                      disabled={verifyingId === p.id}
                      className="px-3 py-1 border border-brand-border rounded font-sans text-xs hover:bg-brand-surface disabled:opacity-50"
                    >
                      {verifyingId === p.id ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Past runs */}
        {pastRuns.length > 0 && (
          <section>
            <h2 className="font-hand text-2xl font-bold mb-3 text-brand-ink">Past Releases</h2>
            <div className="space-y-2">
              {pastRuns.slice(0, 10).map(r => (
                <div key={r.id} className="p-3 bg-brand-surface border border-brand-border rounded flex items-center gap-4">
                  <span className={`font-sans text-xs font-semibold ${statusColor(r.status)}`}>{r.status}</span>
                  <span className="font-sans text-xs text-brand-muted">{r.source}</span>
                  <span className="font-sans text-xs text-brand-muted">{new Date(r.startedAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
