import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { get, post } from '../../lib/api';
import { useAuth } from '../../App';
import { useTheme, type Theme } from '../../lib/theme';
import AppShell from '../../components/layout/AppShell';
import { buildNavItems } from '../../components/layout/navModel';
import { SketchCard, SectionTitle, InkButton } from '../../components/ui';

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

interface CascadeClaim {
  id: string;
  contactId: string;
  status: string;
  notifiedAt: string | null;
  openedAt: string | null;
  acceptedAt: string | null;
  acknowledgedAt: string | null;
  escalatedAt: string | null;
  expiresAt: string;
}

interface CascadeStatus {
  runId: string;
  runStatus: string;
  currentClaimId: string | null;
  claims: CascadeClaim[];
}

function statusColor(status: string, t: Theme) {
  if (status === 'active') return t.accent;
  if (status === 'completed') return '#27AE60';
  if (status === 'failed') return t.danger;
  return t.muted;
}

export default function Release() {
  const { user } = useAuth();
  const t = useTheme();
  const [packets, setPackets] = useState<PacketMeta[]>([]);
  const [runs, setRuns] = useState<ReleaseRun[]>([]);
  const [cascadeStatuses, setCascadeStatuses] = useState<Record<string, CascadeStatus>>({});
  const [error, setError] = useState('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  const load = useCallback(() => {
    Promise.all([
      get<{ packets: PacketMeta[] }>('/api/app/packets'),
      get<{ releaseRuns: ReleaseRun[] }>('/api/app/release-runs'),
    ])
      .then(async ([pd, rd]) => {
        setPackets(pd.packets);
        setRuns(rd.releaseRuns);
        const active = rd.releaseRuns.filter(
          r => !['completed', 'cancelled', 'failed'].includes(r.status),
        );
        const cascadeMap: Record<string, CascadeStatus> = {};
        await Promise.all(
          active.map(r =>
            get<CascadeStatus>(`/api/app/release-runs/${r.id}/cascade`)
              .then(cs => { cascadeMap[r.id] = cs; })
              .catch(() => {}),
          ),
        );
        setCascadeStatuses(cascadeMap);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const isAdmin = user?.role === 'admin' || user?.role === 'sa';
  const activeRuns = runs.filter(r => !['completed', 'cancelled', 'failed'].includes(r.status));
  const pastRuns = runs.filter(r => ['completed', 'cancelled', 'failed'].includes(r.status));

  return (
    <AppShell navItems={buildNavItems(isAdmin)} releaseTo="/release">
      {error && <div style={{ color: t.danger, fontFamily: "'JetBrains Mono',monospace" }}>{error}</div>}
      {!error && (
        <>
          {activeRuns.length > 0 && (
            <div style={{
              background: t.danger, color: '#fff', border: `3px solid ${t.danger}`,
              borderRadius: '4px 12px 4px 12px / 12px 4px 12px 4px', padding: '18px 24px',
              marginBottom: 24, transform: 'rotate(-0.3deg)', fontFamily: "'Caveat',cursive",
              fontSize: 28, fontWeight: 700,
            }}>
              ⚠ WARNING — Release Process Active
            </div>
          )}

          <SectionTitle sub="PACKETS, RELEASE RUNS, AND CASCADE STATUS">Release Mode</SectionTitle>

          {actionMsg && (
            <SketchCard style={{ marginBottom: 16, padding: '12px 16px' }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.ink }}>{actionMsg}</span>
            </SketchCard>
          )}

          {/* Active releases */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: "'Caveat',cursive", fontSize: 26, fontWeight: 700, color: t.ink, marginBottom: 10 }}>Active Releases</div>
            {activeRuns.length === 0 ? (
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted }}>No active release runs.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {activeRuns.map((r, i) => {
                  const cascade = cascadeStatuses[r.id];
                  return (
                    <SketchCard key={r.id} tilt={i % 2 === 0 ? -0.3 : 0.3}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 24, fontWeight: 700, color: statusColor(r.status, t) }}>
                            {r.status.toUpperCase()}
                          </div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, marginTop: 4 }}>
                            Source: {r.source}
                            {r.triggeringSwitchId && ` · switch ${r.triggeringSwitchId.slice(0, 8)}`}
                            {r.relayConnectionId && ` · relay ${r.relayConnectionId.slice(0, 8)}`}
                          </div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted }}>
                            Started: {new Date(r.startedAt).toLocaleString()}
                          </div>
                          {cascade && cascade.claims.length > 0 && (
                            <div style={{ marginTop: 12, borderTop: `1px dashed ${t.border}`, paddingTop: 10 }}>
                              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 18, fontWeight: 700, color: t.ink, marginBottom: 6 }}>
                                Notification Timeline ({cascade.claims.length} contact{cascade.claims.length !== 1 ? 's' : ''})
                              </div>
                              {cascade.claims.map((c, idx) => (
                                <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, padding: '4px 0' }}>
                                  <span style={{ color: t.muted, minWidth: 70 }}>Contact {idx + 1}</span>
                                  <span style={{
                                    color: c.acknowledgedAt ? '#27AE60' : c.escalatedAt ? t.muted : c.status === 'notified' ? t.accent : t.muted,
                                    textDecoration: c.escalatedAt ? 'line-through' : 'none',
                                  }}>{c.status}</span>
                                  {c.acknowledgedAt && <span style={{ color: '#27AE60' }}>✓</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          {cascade && cascade.claims.length === 0 && r.status === 'active' && (
                            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, fontStyle: 'italic', marginTop: 8 }}>
                              Cascade pending — waiting for first tick
                            </div>
                          )}
                        </div>
                        <InkButton size="sm" variant="danger" disabled={cancellingId === r.id} ariaBusy={cancellingId === r.id} onClick={() => cancelRun(r.id)}>
                          {cancellingId === r.id ? 'Cancelling...' : '🛑 Abort'}
                        </InkButton>
                      </div>
                    </SketchCard>
                  );
                })}
              </div>
            )}
          </div>

          {/* Packets */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 26, fontWeight: 700, color: t.ink }}>Packets</div>
              <Link to="/switches" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.accent, textDecoration: 'none' }}>Generate via switch →</Link>
            </div>
            {packets.length === 0 ? (
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.muted }}>
                No packets. <Link to="/switches" style={{ color: t.accent }}>Generate one from a switch.</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {packets.map((p, i) => (
                  <SketchCard key={p.id} tilt={i % 2 === 0 ? 0.2 : -0.2} style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                      <div>
                        <div style={{ fontFamily: "'Caveat',cursive", fontSize: 20, fontWeight: 700, color: t.ink }}>
                          v{p.version}{p.switchId && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, marginLeft: 8 }}>switch {p.switchId.slice(0, 8)}</span>}
                        </div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, marginTop: 2 }}>
                          Created: {new Date(p.createdAt).toLocaleDateString()}{p.storageProvider && ` · storage: ${p.storageProvider}`}
                        </div>
                        {p.lastVerifiedAt && (
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#27AE60' }}>Verified: {new Date(p.lastVerifiedAt).toLocaleString()}</div>
                        )}
                        {!p.lastVerifiedAt && p.storageBucket && (
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted }}>Not yet verified</div>
                        )}
                      </div>
                      <InkButton size="sm" variant="ghost" disabled={verifyingId === p.id} ariaBusy={verifyingId === p.id} onClick={() => verifyPacket(p.id)}>
                        {verifyingId === p.id ? 'Verifying...' : 'Verify'}
                      </InkButton>
                    </div>
                  </SketchCard>
                ))}
              </div>
            )}
          </div>

          {/* Past runs */}
          {pastRuns.length > 0 && (
            <div>
              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 26, fontWeight: 700, color: t.ink, marginBottom: 10 }}>Past Releases</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pastRuns.slice(0, 10).map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 14px', border: `1.5px solid ${t.border}`, borderRadius: '3px 8px 3px 8px / 8px 3px 8px 3px' }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: statusColor(r.status, t) }}>{r.status}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted }}>{r.source}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted }}>{new Date(r.startedAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
