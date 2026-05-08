import { useEffect, useState } from 'react';
import {
  listSwitches,
  createSwitch,
  deleteSwitch,
  getSwitchReadiness,
  armSwitch,
  pauseSwitch,
  cancelSwitch,
  checkInSwitch,
  type Switch,
  type SwitchReadiness,
} from '../../lib/switches';

const emptyForm = {
  name: '',
  mode: 'heartbeat',
  triggerAt: '',
  heartbeatIntervalDays: '30',
  gracePeriodHours: '48',
  warningWindowDays: '7',
};

export default function Trigger() {
  const [switches, setSwitches] = useState<Switch[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [readiness, setReadiness] = useState<Record<string, SwitchReadiness>>({});

  useEffect(() => {
    listSwitches()
      .then((r) => setSwitches(r.switches))
      .catch((e: Error) => setError(e.message));
  }, []);

  async function loadReadiness(id: string) {
    try {
      const r = await getSwitchReadiness(id);
      setReadiness((prev) => ({ ...prev, [id]: r }));
    } catch {
      // ignore
    }
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      const input: Parameters<typeof createSwitch>[0] = {
        name: form.name,
        mode: form.mode,
        gracePeriodHours: parseInt(form.gracePeriodHours, 10),
        warningWindowDays: parseInt(form.warningWindowDays, 10),
      };
      if (form.mode === 'trip' && form.triggerAt) {
        input.triggerAt = form.triggerAt;
      }
      if (form.mode === 'heartbeat') {
        input.heartbeatIntervalDays = parseInt(form.heartbeatIntervalDays, 10);
      }
      const result = await createSwitch(input);
      setSwitches((prev) => [...prev, result.switch]);
      setShowForm(false);
      setForm(emptyForm);
      await loadReadiness(result.switch.id);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to create switch');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(
    id: string,
    action: 'arm' | 'pause' | 'cancel' | 'check-in',
  ) {
    try {
      let result: { switch: Switch };
      if (action === 'arm') result = await armSwitch(id);
      else if (action === 'pause') result = await pauseSwitch(id);
      else if (action === 'cancel') result = await cancelSwitch(id);
      else result = await checkInSwitch(id);
      setSwitches((prev) =>
        prev.map((s) => (s.id === id ? result.switch : s)),
      );
      await loadReadiness(id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Action failed');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this switch? This cannot be undone.')) return;
    try {
      await deleteSwitch(id);
      setSwitches((prev) => prev.filter((s) => s.id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-hand text-4xl font-bold text-brand-ink">Switches</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="font-sans font-semibold text-sm px-4 py-2 bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors"
          >
            {showForm ? 'Cancel' : '+ New Switch'}
          </button>
        </div>

        <p className="font-sans text-xs text-brand-muted mb-6 p-3 bg-brand-surface border border-brand-border rounded">
          Phase 2 supports switch scheduling, reminders, and trigger-state tracking. Managed
          packet release and contact cascade are added in the next phase.
        </p>

        {error && <p className="font-sans text-sm text-brand-danger mb-4">{error}</p>}

        {/* Create form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-6 p-6 bg-brand-surface border-2 border-brand-border rounded-lg"
          >
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-4">New Switch</h2>

            <input
              name="name"
              placeholder="Switch name"
              value={form.name}
              onChange={handleChange}
              required
              className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
            />

            <div className="mb-3">
              <label className="font-sans text-xs text-brand-muted block mb-1">Mode</label>
              <select
                name="mode"
                value={form.mode}
                onChange={handleChange}
                className="w-full font-sans text-sm p-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
              >
                <option value="heartbeat">Heartbeat — periodic check-in</option>
                <option value="trip">Trip wire — fixed date/time</option>
              </select>
            </div>

            {form.mode === 'trip' && (
              <div className="mb-3">
                <label className="font-sans text-xs text-brand-muted block mb-1">
                  Trigger at (date/time)
                </label>
                <input
                  name="triggerAt"
                  type="datetime-local"
                  value={form.triggerAt}
                  onChange={handleChange}
                  className="w-full font-sans text-sm p-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
                />
              </div>
            )}

            {form.mode === 'heartbeat' && (
              <div className="mb-3">
                <label className="font-sans text-xs text-brand-muted block mb-1">
                  Heartbeat interval (days)
                </label>
                <input
                  name="heartbeatIntervalDays"
                  type="number"
                  min="1"
                  max="365"
                  value={form.heartbeatIntervalDays}
                  onChange={handleChange}
                  className="w-full font-sans text-sm p-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="font-sans text-xs text-brand-muted block mb-1">
                  Grace period (hours)
                </label>
                <input
                  name="gracePeriodHours"
                  type="number"
                  min="1"
                  value={form.gracePeriodHours}
                  onChange={handleChange}
                  className="w-full font-sans text-sm p-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
                />
              </div>
              <div>
                <label className="font-sans text-xs text-brand-muted block mb-1">
                  Warning window (days)
                </label>
                <input
                  name="warningWindowDays"
                  type="number"
                  min="1"
                  value={form.warningWindowDays}
                  onChange={handleChange}
                  className="w-full font-sans text-sm p-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
                />
              </div>
            </div>

            {submitError && (
              <p className="font-sans text-sm text-brand-danger mb-3">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full font-sans font-semibold text-sm p-3 cursor-pointer bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Switch'}
            </button>
          </form>
        )}

        {/* Switch list */}
        {switches.length === 0 && !showForm ? (
          <div className="p-6 bg-brand-surface border border-dashed border-brand-border rounded-lg text-center">
            <p className="font-sans text-sm text-brand-muted">No switches yet.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-2 font-sans text-sm text-brand-accent hover:underline"
            >
              Create your first switch
            </button>
          </div>
        ) : (
          <ul className="space-y-4">
            {switches.map((sw) => (
              <SwitchCard
                key={sw.id}
                sw={sw}
                readiness={readiness[sw.id]}
                onLoadReadiness={() => loadReadiness(sw.id)}
                onAction={handleAction}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function statusColor(status: string) {
  if (status === 'active') return 'text-brand-success';
  if (status === 'triggered') return 'text-brand-danger';
  if (status === 'warning') return 'text-amber-600';
  return 'text-brand-muted';
}

function SwitchCard({
  sw,
  readiness,
  onLoadReadiness,
  onAction,
  onDelete,
}: {
  sw: Switch;
  readiness?: SwitchReadiness;
  onLoadReadiness: () => void;
  onAction: (id: string, action: 'arm' | 'pause' | 'cancel' | 'check-in') => void;
  onDelete: (id: string) => void;
}) {
  return (
    <li className="p-4 bg-brand-surface border border-brand-border rounded-lg">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-sans text-sm font-semibold text-brand-ink">{sw.name}</p>
          <p className="font-sans text-xs text-brand-muted">
            {sw.mode} ·{' '}
            <span className={statusColor(sw.status)}>{sw.status}</span>
          </p>
          {sw.nextCheckInDueAt && (
            <p className="font-sans text-xs text-brand-muted">
              Next check-in: {new Date(sw.nextCheckInDueAt).toLocaleString()}
            </p>
          )}
          {sw.triggerAt && (
            <p className="font-sans text-xs text-brand-muted">
              Trigger at: {new Date(sw.triggerAt).toLocaleString()}
            </p>
          )}
        </div>
        <button
          onClick={() => onDelete(sw.id)}
          className="font-sans text-xs text-brand-danger hover:underline flex-shrink-0"
        >
          Delete
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        {(sw.status === 'draft' || sw.status === 'paused') && (
          <ActionButton label="Arm" onClick={() => onAction(sw.id, 'arm')} />
        )}
        {sw.status === 'active' && (
          <>
            <ActionButton label="Check In" onClick={() => onAction(sw.id, 'check-in')} primary />
            <ActionButton label="Pause" onClick={() => onAction(sw.id, 'pause')} />
            <ActionButton label="Cancel" onClick={() => onAction(sw.id, 'cancel')} danger />
          </>
        )}
        {sw.status === 'warning' && (
          <>
            <ActionButton label="Check In" onClick={() => onAction(sw.id, 'check-in')} primary />
            <ActionButton label="Cancel" onClick={() => onAction(sw.id, 'cancel')} danger />
          </>
        )}
      </div>

      {/* Readiness */}
      {readiness ? (
        <div className="mt-2 border-t border-brand-border pt-2">
          <p className="font-sans text-xs text-brand-muted mb-1">
            Readiness:{' '}
            <span className={readiness.ready ? 'text-brand-success' : 'text-brand-danger'}>
              {readiness.ready ? 'Ready' : 'Not ready'}
            </span>
          </p>
          <ul className="space-y-1">
            {readiness.checks.map((check) => (
              <li key={check.key} className="font-sans text-xs flex items-start gap-1">
                <span className={check.passed ? 'text-brand-success' : 'text-brand-danger'}>
                  {check.passed ? '✓' : '✗'}
                </span>
                <span className={check.passed ? 'text-brand-muted' : 'text-brand-ink'}>
                  {check.label}
                  {check.message ? ` — ${check.message}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button
          onClick={onLoadReadiness}
          className="font-sans text-xs text-brand-accent hover:underline"
        >
          Check readiness
        </button>
      )}
    </li>
  );
}

function ActionButton({
  label,
  onClick,
  primary,
  danger,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  let cls =
    'font-sans text-xs px-3 py-1 rounded border transition-colors cursor-pointer ';
  if (primary) {
    cls += 'bg-brand-ink text-brand-bg border-brand-ink hover:bg-brand-accent hover:border-brand-accent';
  } else if (danger) {
    cls += 'bg-brand-bg text-brand-danger border-brand-danger hover:bg-brand-danger hover:text-brand-bg';
  } else {
    cls += 'bg-brand-bg text-brand-ink border-brand-border hover:border-brand-accent';
  }
  return (
    <button onClick={onClick} className={cls}>
      {label}
    </button>
  );
}
