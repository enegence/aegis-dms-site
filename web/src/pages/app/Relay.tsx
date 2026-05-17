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
import { useAuth } from '../../App';
import { useTheme } from '../../lib/theme';
import AppShell from '../../components/layout/AppShell';
import { buildNavItems } from '../../components/layout/navModel';
import { SketchCard, SectionTitle, InkButton } from '../../components/ui';

interface NewKeyReveal {
  connectionId: string;
  apiKey: string;
}

export default function Relay() {
  const { user } = useAuth();
  const t = useTheme();
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
      setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'disconnected' } : c)));
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
    if (next === null) return;
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

  const isAdmin = user?.role === 'admin' || user?.role === 'sa';

  return (
    <AppShell navItems={buildNavItems(isAdmin)} releaseTo="/release">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <SectionTitle sub="CLOUD MONITORING FOR YOUR SELF-HOSTED INSTANCE">Relay Connections</SectionTitle>
        {!showConnect && (
          <InkButton size="sm" onClick={() => setShowConnect(true)}>+ Connect Instance</InkButton>
        )}
      </div>

      <SketchCard style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, lineHeight: 1.7 }}>
          Relay Monitoring detects missed heartbeats from your self-hosted Aegis Core instance and
          alerts you. API keys are never sent in URLs — your instance exchanges a short-lived code
          for a key server-to-server.
        </div>
      </SketchCard>

      {error && <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.danger, marginBottom: 12 }}>{error}</p>}

      {newKey && (
        <SketchCard style={{ marginBottom: 20, border: `2px solid ${t.danger}` }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: t.danger, marginBottom: 8 }}>
            Copy this key now. Aegis stores only a hash and cannot show it again.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code style={{ flex: 1, fontFamily: 'monospace', fontSize: 11, color: t.ink, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 4, padding: 8, wordBreak: 'break-all', userSelect: 'all' }}>
              {newKey.apiKey}
            </code>
            <InkButton size="sm" onClick={() => copyKey(newKey.apiKey)}>{copied ? 'Copied!' : 'Copy'}</InkButton>
          </div>
          <button onClick={() => setNewKey(null)} style={{ marginTop: 8, background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
            I have saved this key, dismiss
          </button>
        </SketchCard>
      )}

      {showConnect && (
        <RelayConnectCard
          onConnected={() => { setShowConnect(false); loadConnections(); }}
          onCancel={() => setShowConnect(false)}
        />
      )}

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
    </AppShell>
  );
}
