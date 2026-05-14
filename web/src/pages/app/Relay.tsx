import { useEffect, useState } from 'react';
import {
  listRelayConnections,
  rotateRelayKey,
  revokeRelayConnection,
  deleteRelayConnection,
  renameRelayConnection,
  type RelayConnection,
} from '../../lib/relay';
import { RelayConnectionList } from '../../components/relay/RelayConnectionList';
import { RelayConnectCard } from '../../components/relay/RelayConnectCard';
import { Nav } from '../../components/Nav';

interface NewKeyReveal {
  connectionId: string;
  apiKey: string;
}

export default function Relay() {
  const [connections, setConnections] = useState<RelayConnection[]>([]);
  const [error, setError] = useState('');
  const [showConnect, setShowConnect] = useState(false);
  const [newKey, setNewKey] = useState<NewKeyReveal | null>(null);
  const [copied, setCopied] = useState(false);

  function loadConnections() {
    listRelayConnections()
      .then((r) => setConnections(r.connections))
      .catch((e: Error) => setError(e.message));
  }

  useEffect(() => {
    loadConnections();
  }, []);

  async function handleRotate(id: string) {
    if (!confirm('Rotate this API key? The existing key will stop working immediately.')) return;
    try {
      const result = await rotateRelayKey(id);
      setConnections((prev) => prev.map((c) => (c.id === id ? result.connection : c)));
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
        prev.map((c) => (c.id === id ? { ...c, status: 'disconnected' } : c)),
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

  async function handleRename(id: string, currentLabel: string | null) {
    const next = prompt('Enter new label:', currentLabel ?? '');
    if (next === null) return; // cancelled
    try {
      const result = await renameRelayConnection(id, next);
      setConnections((prev) => prev.map((c) => (c.id === id ? result.connection : c)));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Rename failed');
    }
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <Nav />
      <div className="p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-hand text-4xl font-bold text-brand-ink">Relay Connections</h1>
          {!showConnect && (
            <button
              onClick={() => setShowConnect(true)}
              className="font-sans font-semibold text-sm px-4 py-2 bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors"
            >
              + Connect Instance
            </button>
          )}
        </div>

        <p className="font-sans text-xs text-brand-muted mb-6 p-3 bg-brand-surface border border-brand-border rounded">
          Relay Monitoring detects missed heartbeats from your self-hosted Aegis Core instance
          and alerts you. API keys are never sent in URLs — your instance exchanges a
          short-lived code for a key server-to-server.
        </p>

        {error && <p className="font-sans text-sm text-brand-danger mb-4">{error}</p>}

        {/* New key reveal (after rotate) */}
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

        {/* Secure connect flow */}
        {showConnect && (
          <RelayConnectCard
            onConnected={() => {
              setShowConnect(false);
              loadConnections();
            }}
            onCancel={() => setShowConnect(false)}
          />
        )}

        {/* Connection list */}
        {!showConnect && (
          <RelayConnectionList
            connections={connections}
            onRotate={handleRotate}
            onRevoke={handleRevoke}
            onDelete={handleDelete}
            onRename={handleRename}
            onConnect={() => setShowConnect(true)}
          />
        )}
      </div>
      </div>
    </div>
  );
}
