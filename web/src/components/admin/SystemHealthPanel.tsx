interface SystemHealth {
  status: 'ok' | 'degraded';
  dbConnected: boolean;
  uptime: number;
  timestamp: string;
}

interface SystemHealthPanelProps {
  health: SystemHealth;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export default function SystemHealthPanel({ health }: SystemHealthPanelProps) {
  const isOk = health.status === 'ok';

  return (
    <div className="p-4 bg-brand-surface border border-brand-border rounded-lg">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-3 h-3 rounded-full ${isOk ? 'bg-green-500' : 'bg-brand-danger'}`} />
        <span className={`font-semibold font-sans text-sm ${isOk ? 'text-green-700' : 'text-brand-danger'}`}>
          {isOk ? 'System OK' : 'System Degraded'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm font-sans">
        <div className="p-3 bg-brand-bg border border-brand-border rounded">
          <div className="text-brand-muted text-xs mb-1">Database</div>
          <div className={`font-semibold ${health.dbConnected ? 'text-green-600' : 'text-brand-danger'}`}>
            {health.dbConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        <div className="p-3 bg-brand-bg border border-brand-border rounded">
          <div className="text-brand-muted text-xs mb-1">Server Uptime</div>
          <div className="font-semibold text-brand-ink">{formatUptime(health.uptime)}</div>
        </div>

        <div className="p-3 bg-brand-bg border border-brand-border rounded col-span-2">
          <div className="text-brand-muted text-xs mb-1">Last Checked</div>
          <div className="font-semibold text-brand-ink">
            {new Date(health.timestamp).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
