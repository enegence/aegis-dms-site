import { RelayHeartbeatStatus } from './RelayHeartbeatStatus';
import type { RelayConnection } from '../../lib/relay';

interface Props {
  connections: RelayConnection[];
  onRotate: (id: string) => void;
  onRevoke: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, currentLabel: string | null) => void;
  onConnect: () => void;
}

export function RelayConnectionList({
  connections,
  onRotate,
  onRevoke,
  onDelete,
  onRename,
  onConnect,
}: Props) {
  if (connections.length === 0) {
    return (
      <div className="p-6 bg-brand-surface border border-dashed border-brand-border rounded-lg text-center">
        <p className="font-sans text-sm text-brand-muted">No relay connections yet.</p>
        <button
          onClick={onConnect}
          className="mt-2 font-sans text-sm text-brand-accent hover:underline"
        >
          Connect your first self-hosted instance
        </button>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {connections.map((conn) => (
        <li
          key={conn.id}
          className="p-4 bg-brand-surface border border-brand-border rounded-lg"
        >
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-sans text-sm font-semibold text-brand-ink">
                  {conn.label ?? <span className="text-brand-muted italic">Unlabeled</span>}
                </p>
                <button
                  onClick={() => onRename(conn.id, conn.label)}
                  className="font-sans text-xs text-brand-muted hover:text-brand-accent"
                  title="Rename connection"
                >
                  ✏
                </button>
              </div>
              <div className="flex items-center gap-2">
                <RelayHeartbeatStatus
                  lastHeartbeatAt={conn.lastHeartbeatAt}
                  status={conn.status}
                />
                <span className="text-brand-muted text-xs">·</span>
                <span className="font-sans text-xs text-brand-muted">{conn.mode}</span>
              </div>
              <p className="font-sans text-xs text-brand-muted mt-0.5">
                Connected {new Date(conn.createdAt).toLocaleDateString()}
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
              onClick={() => onDelete(conn.id)}
              className="font-sans text-xs text-brand-danger hover:underline flex-shrink-0"
            >
              Delete
            </button>
          </div>

          {conn.status !== 'disconnected' && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onRotate(conn.id)}
                className="font-sans text-xs px-3 py-1 rounded border border-brand-border bg-brand-bg text-brand-ink hover:border-brand-accent transition-colors"
              >
                Rotate Key
              </button>
              <button
                onClick={() => onRevoke(conn.id)}
                className="font-sans text-xs px-3 py-1 rounded border border-brand-danger bg-brand-bg text-brand-danger hover:bg-brand-danger hover:text-brand-bg transition-colors"
              >
                Revoke
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
