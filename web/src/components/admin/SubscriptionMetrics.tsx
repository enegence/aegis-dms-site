interface AdminSubscription {
  id: string;
  userId: string;
  email: string;
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

interface SubscriptionMetricsProps {
  subscriptions: AdminSubscription[];
}

function statusBadge(status: string) {
  if (status === 'active') return 'bg-green-100 text-green-800';
  if (status === 'cancelled' || status === 'canceled') return 'bg-red-100 text-brand-danger';
  if (status === 'trialing') return 'bg-blue-100 text-blue-800';
  return 'bg-brand-surface text-brand-muted';
}

export default function SubscriptionMetrics({ subscriptions }: SubscriptionMetricsProps) {
  const active = subscriptions.filter(s => s.status === 'active').length;
  const relay = subscriptions.filter(s => s.plan === 'relay').length;
  const hosted = subscriptions.filter(s => s.plan === 'hosted').length;

  return (
    <div>
      <div className="flex gap-6 mb-4 text-sm font-sans">
        <div>
          <span className="text-brand-muted">Total: </span>
          <span className="font-semibold text-brand-ink">{subscriptions.length}</span>
        </div>
        <div>
          <span className="text-brand-muted">Active: </span>
          <span className="font-semibold text-green-600">{active}</span>
        </div>
        <div>
          <span className="text-brand-muted">Relay: </span>
          <span className="font-semibold text-brand-ink">{relay}</span>
        </div>
        <div>
          <span className="text-brand-muted">Hosted: </span>
          <span className="font-semibold text-brand-ink">{hosted}</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-sans border border-brand-border rounded-lg overflow-hidden">
          <thead className="bg-brand-surface text-brand-muted">
            <tr>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Plan</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Period End</th>
              <th className="px-4 py-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-brand-muted">No subscriptions.</td>
              </tr>
            )}
            {subscriptions.map(s => (
              <tr key={s.id} className="border-t border-brand-border hover:bg-brand-surface/50">
                <td className="px-4 py-2 text-brand-ink">{s.email}</td>
                <td className="px-4 py-2 text-brand-muted capitalize">{s.plan}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${statusBadge(s.status)}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-brand-muted">
                  {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-2 text-brand-muted">
                  {new Date(s.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
