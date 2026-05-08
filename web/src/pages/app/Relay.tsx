import { useEffect, useState } from 'react';
import {
  listRelayConnections,
  createRelayConnection,
  rotateRelayKey,
  revokeRelayConnection,
  deleteRelayConnection,
  type RelayConnection,
} from '../../lib/relay';

interface NewKeyReveal {
  connectionId: string;
  apiKey: string;
}

export default function Relay() {
  const [connections, setConnections] = useState<RelayConnection[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [mode, setMode] = useState('relay_monitoring');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [newKey, setNewKey] = useState<NewKeyReveal | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    listRelayConnections()
      .then((r) => setConnections(r.connections))
      .catch((e: Error) => setError(e.message));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      const result = await createRelayConnection({
        label: label || undefined,
        mode,
      });
      setConnections((prev) => [...prev, result.connection]);
      setNewKey({ connectionId: result.connection.id, apiKey: result.apiKey });
      setShowForm(false);
      setLabel('');
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to create connection');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRotate(id: string) {
    if (!confirm('Rotate this API key? The existing key will stop working immediately.')) return;
    try {
      const result = await rotateRelayKey(id);
      setConnections((prev) =>
        prev.map((c) => (c.id === id ? result.connection : c)),
      );
      setNewKey({ connectionId: id, apiKey: result.apiKey });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Rotate failed');
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this connection? The relay will stop sending heartbeats.')) return;
    try {
      await revokeRelayConnection(id);
      setConnections((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, status: 'revoked' } : c,
        ),
      );
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Revoke failed');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this relay connection? This cannot be undone.')) return;
    try {
      await deleteRelayConnection(id);
      setConnections((prev) => prev.filter((c) => c.id !== id));
      if (newKey?.connectionId === id) setNewKey(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function statusColor(status: string) {
    if (status === 'active') return 'text-brand-success';
    if (status === 'offline') return 'text-brand-danger';
    if (status === 'revoked') return 'text-brand-muted line-through';
    return 'text-brand-muted';
  }

  return (
    <div className="min-h-screen bg-brand-bg p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-hand text-4xl font-bold text-brand-ink">Relay Connections</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="font-sans font-semibold text-sm px-4 py-2 bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors"
          >
            {showForm ? 'Cancel' : '+ New Connection'}
          </button>
        </div>

        <p className="font-sans text-xs text-brand-muted mb-6 p-3 bg-brand-surface border border-brand-border rounded">
          Relay Monitoring detects missed heartbeats and alerts you. It does not complete release
          by itself unless Relay Escrow is configured in a later phase.
        </p>

        {error && <p className="font-sans text-sm text-brand-danger mb-4">{error}</p>}

        {/* New key reveal */}
        {newKey && (
          <div className="mb-6 p-4 bg-brand-surface border-2 border-brand-danger rounded-lg">
            <p className="font-sans text-sm font-semibold text-brand-danger mb-1">
              Copy this key now. Aegis stores only a hash and cannot show it again.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <code className="flex-1 font-mono text-xs text-brand-ink bg-brand-bg border border-brand-border rounded p-2 break-all select-all">
                {newKey.apiKey}
              </code>
              <button
                onClick={() => copyKey(newKey.apiKey)}
                className="font-sans text-xs px-3 py-2 bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors flex-shrink-0"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button
              onClick={() => setNewKey(null)}
              className="mt-2 font-sans text-xs text-brand-muted hover:underline"
            >
              I have saved this key, dismiss
            </button>
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-6 p-6 bg-brand-surface border-2 border-brand-border rounded-lg"
          >
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-4">
              New Relay Connection
            </h2>

            <input
              placeholder="Label (optional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
            />

            <div className="mb-4">
              <label className="font-sans text-xs text-brand-muted block mb-1">Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full font-sans text-sm p-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
              >
                <option value="relay_monitoring">Relay Monitoring</option>
                <option value="relay_escrow">Relay Escrow (Phase 2)</option>
              </select>
            </div>

            {submitError && (
              <p className="font-sans text-sm text-brand-danger mb-3">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full font-sans font-semibold text-sm p-3 cursor-pointer bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Connection'}
            </button>
          </form>
        )}

        {/* Connection list */}
        {connections.length === 0 && !showForm ? (
          <div className="p-6 bg-brand-surface border border-dashed border-brand-border rounded-lg text-center">
            <p className="font-sans text-sm text-brand-muted">No relay connections yet.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-2 font-sans text-sm text-brand-accent hover:underline"
            >
              Add your first relay connection
            </button>
          </div>
        ) : (
          <ul className="space-y-4">
            {connections.map((conn) => (
              <li
                key={conn.id}
                className="p-4 bg-brand-surface border border-brand-border rounded-lg"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-sm font-semibold text-brand-ink">
                      {conn.label ?? <span className="text-brand-muted italic">Unlabeled</span>}
                    </p>
                    <p className="font-sans text-xs">
                      <span className={statusColor(conn.status)}>{conn.status}</span>
                      <span className="text-brand-muted"> · {conn.mode}</span>
                    </p>
                    <p className="font-sans text-xs text-brand-muted">
                      Created {new Date(conn.createdAt).toLocaleDateString()}
                    </p>
                    {conn.lastHeartbeatAt && (
                      <p className="font-sans text-xs text-brand-muted">
                        Last heartbeat: {new Date(conn.lastHeartbeatAt).toLocaleString()}
                      </p>
                    )}
                    {conn.lastExpectedHeartbeatAt && (
                      <p className="font-sans text-xs text-brand-muted">
                        Expected by: {new Date(conn.lastExpectedHeartbeatAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(conn.id)}
                    className="font-sans text-xs text-brand-danger hover:underline flex-shrink-0"
                  >
                    Delete
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {conn.status !== 'revoked' && (
                    <>
                      <button
                        onClick={() => handleRotate(conn.id)}
                        className="font-sans text-xs px-3 py-1 rounded border border-brand-border bg-brand-bg text-brand-ink hover:border-brand-accent transition-colors"
                      >
                        Rotate Key
                      </button>
                      <button
                        onClick={() => handleRevoke(conn.id)}
                        className="font-sans text-xs px-3 py-1 rounded border border-brand-danger bg-brand-bg text-brand-danger hover:bg-brand-danger hover:text-brand-bg transition-colors"
                      >
                        Revoke
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
