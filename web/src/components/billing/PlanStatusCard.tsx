interface PlanStatusCardProps {
  plan: 'relay' | 'hosted';
  status: string;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    trialing: 'bg-blue-100 text-blue-800',
    past_due: 'bg-amber-100 text-amber-800',
    paused: 'bg-amber-100 text-amber-800',
    cancelled: 'bg-red-100 text-red-800',
    inactive: 'bg-gray-100 text-gray-600',
  };
  const color = colorMap[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block font-sans text-xs font-semibold px-2 py-0.5 rounded ${color}`}>
      {status}
    </span>
  );
}

export function PlanStatusCard({ plan, status, currentPeriodEnd, cancelledAt }: PlanStatusCardProps) {
  const planLabel = plan === 'relay' ? 'Aegis Relay' : 'Aegis Hosted';

  return (
    <div className="p-4 bg-brand-surface border border-brand-border rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-sans text-sm font-semibold text-brand-ink">{planLabel}</h3>
        <StatusBadge status={status} />
      </div>

      {cancelledAt && (
        <p className="font-sans text-xs text-brand-danger mt-1">
          Cancelled on {new Date(cancelledAt).toLocaleDateString()}
        </p>
      )}

      {currentPeriodEnd && !cancelledAt && (
        <p className="font-sans text-xs text-brand-muted mt-1">
          Renews {new Date(currentPeriodEnd).toLocaleDateString()}
        </p>
      )}

      {currentPeriodEnd && cancelledAt && (
        <p className="font-sans text-xs text-brand-muted mt-1">
          Access until {new Date(currentPeriodEnd).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
