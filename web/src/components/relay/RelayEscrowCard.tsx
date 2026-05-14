/**
 * RelayEscrowCard — Relay Escrow configuration UI.
 *
 * Displays the required trust model disclosure, records the versioned
 * acknowledgement (relay-escrow-v1), and provides enable/disable controls
 * for escrow material.
 *
 * Required disclosure copy is mandated by Phase 4 Task 4 spec — do not alter.
 */

import { useState, useEffect, useCallback } from 'react';
import { get, post } from '../../lib/api';

interface EscrowStatus {
  connectionExists: boolean;
  acknowledged: boolean;
  acknowledgementId: string | null;
  enabled: boolean;
  revokedAt: string | null;
  policyVersion: string;
}

interface Props {
  connectionId: string;
  label: string | null;
}

export function RelayEscrowCard({ connectionId, label }: Props) {
  const [status, setStatus] = useState<EscrowStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Acknowledge flow
  const [ackSaving, setAckSaving] = useState(false);

  // Enable flow
  const [showEnableForm, setShowEnableForm] = useState(false);
  const [material, setMaterial] = useState('');
  const [enabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState('');

  // Disable flow
  const [disabling, setDisabling] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await get<EscrowStatus>(`/api/relay/${connectionId}/escrow`);
      setStatus(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load escrow status.');
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleAcknowledge = async () => {
    setAckSaving(true);
    setError('');
    try {
      await post('/api/relay/escrow/acknowledge', {});
      await loadStatus();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to record acknowledgement.');
    } finally {
      setAckSaving(false);
    }
  };

  const handleEnable = async () => {
    if (!material.trim()) {
      setEnableError('Release material is required.');
      return;
    }
    setEnabling(true);
    setEnableError('');
    try {
      await post(`/api/relay/${connectionId}/escrow/enable`, {
        material: material.trim(),
        materialType: 'release_key',
        contactIds: [],
        packetId: undefined,
      });
      setMaterial('');
      setShowEnableForm(false);
      await loadStatus();
    } catch (e: unknown) {
      setEnableError(e instanceof Error ? e.message : 'Failed to enable escrow.');
    } finally {
      setEnabling(false);
    }
  };

  const handleDisable = async () => {
    setDisabling(true);
    setError('');
    try {
      await post(`/api/relay/${connectionId}/escrow/disable`, {});
      await loadStatus();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to disable escrow.');
    } finally {
      setDisabling(false);
    }
  };

  const displayName = label ?? connectionId.slice(0, 8);

  if (loading) {
    return (
      <div className="p-4 bg-brand-surface border border-brand-border rounded-lg">
        <p className="font-sans text-xs text-brand-muted">Loading escrow status…</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-brand-surface border border-brand-border rounded-lg space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h3 className="font-sans text-sm font-semibold text-brand-ink">Relay Escrow</h3>
        {status?.enabled ? (
          <span className="font-sans text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">
            Enabled
          </span>
        ) : (
          <span className="font-sans text-xs px-1.5 py-0.5 bg-brand-border text-brand-muted rounded">
            Disabled
          </span>
        )}
      </div>

      {/* Required disclosure copy — do not alter */}
      <div className="rounded-lg bg-brand-bg border border-brand-border p-3">
        <p className="font-sans text-xs text-brand-ink leading-relaxed">
          Relay Escrow increases release resilience by allowing Aegis SaaS to execute your configured
          release policy if your self-hosted server remains offline. This requires trusting Aegis SaaS
          with release authority or release material according to the selected configuration.
        </p>
      </div>

      {error && (
        <p className="font-sans text-xs text-brand-danger">{error}</p>
      )}

      {/* Step 1: Acknowledge trust model */}
      {!status?.acknowledged && (
        <div className="space-y-2">
          <p className="font-sans text-xs text-brand-muted">
            You must acknowledge the Relay Escrow trust model before enabling escrow for{' '}
            <span className="text-brand-ink font-medium">{displayName}</span>.
          </p>
          <button
            onClick={handleAcknowledge}
            disabled={ackSaving}
            className="w-full py-2 px-4 bg-brand-accent text-white rounded-lg font-sans text-sm font-semibold
                       hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ackSaving ? 'Recording acknowledgement…' : 'I understand — acknowledge and continue'}
          </button>
        </div>
      )}

      {/* Step 2: Enable / Disable escrow */}
      {status?.acknowledged && !status.enabled && (
        <div className="space-y-2">
          {!showEnableForm ? (
            <button
              onClick={() => setShowEnableForm(true)}
              className="w-full py-2 px-4 bg-brand-accent text-white rounded-lg font-sans text-sm font-semibold
                         hover:opacity-90 transition-opacity"
            >
              Enable Relay Escrow for {displayName}
            </button>
          ) : (
            <div className="space-y-2">
              <label className="block font-sans text-xs font-medium text-brand-ink">
                Release material (encrypted before storage)
              </label>
              <textarea
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                rows={3}
                placeholder="Paste your release key or material here"
                className="w-full px-3 py-2 border border-brand-border rounded-lg font-mono text-xs
                           bg-brand-bg text-brand-ink placeholder-brand-muted focus:outline-none
                           focus:ring-1 focus:ring-brand-accent resize-none"
              />
              {enableError && (
                <p className="font-sans text-xs text-brand-danger">{enableError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleEnable}
                  disabled={enabling}
                  className="flex-1 py-2 px-4 bg-brand-accent text-white rounded-lg font-sans text-sm font-semibold
                             hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {enabling ? 'Enabling…' : 'Enable escrow'}
                </button>
                <button
                  onClick={() => { setShowEnableForm(false); setEnableError(''); setMaterial(''); }}
                  className="flex-1 py-2 px-4 border border-brand-border text-brand-ink rounded-lg font-sans text-sm
                             hover:border-brand-accent transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {status?.enabled && (
        <div className="space-y-2">
          <p className="font-sans text-xs text-brand-muted">
            Escrow is active for{' '}
            <span className="text-brand-ink font-medium">{displayName}</span>.
            Aegis SaaS will execute your release policy if this connection goes offline.
          </p>
          <button
            onClick={handleDisable}
            disabled={disabling}
            className="w-full py-2 px-4 border border-brand-danger text-brand-danger rounded-lg font-sans text-sm
                       hover:bg-brand-danger hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {disabling ? 'Disabling…' : 'Disable Relay Escrow'}
          </button>
        </div>
      )}

      {status?.revokedAt && !status.enabled && status.acknowledged && (
        <p className="font-sans text-xs text-brand-muted">
          Previously revoked on {new Date(status.revokedAt).toLocaleDateString()}.
          You can re-enable escrow at any time.
        </p>
      )}
    </div>
  );
}
