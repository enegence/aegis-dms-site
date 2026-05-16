import { useEffect, useState, type CSSProperties } from 'react';
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
import { useAuth } from '../../App';
import { useTheme, type Theme } from '../../lib/theme';
import AppShell from '../../components/layout/AppShell';
import { buildNavItems } from '../../components/layout/navModel';
import { SketchCard, SectionTitle, InkButton } from '../../components/ui';

const emptyForm = {
  name: '',
  mode: 'heartbeat',
  triggerAt: '',
  heartbeatIntervalDays: '30',
  gracePeriodHours: '48',
  warningWindowDays: '7',
};

export default function Trigger() {
  const { user } = useAuth();
  const t = useTheme();
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

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
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

  async function handleAction(id: string, action: 'arm' | 'pause' | 'cancel' | 'check-in') {
    try {
      let result: { switch: Switch };
      if (action === 'arm') result = await armSwitch(id);
      else if (action === 'pause') result = await pauseSwitch(id);
      else if (action === 'cancel') result = await cancelSwitch(id);
      else result = await checkInSwitch(id);
      setSwitches((prev) => prev.map((s) => (s.id === id ? result.switch : s)));
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

  const isAdmin = user?.role === 'admin' || user?.role === 'sa';

  const inputStyle: CSSProperties = {
    width: '100%', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, padding: '8px 10px',
    marginBottom: 8, background: t.bg, border: `1.5px solid ${t.border}`, borderRadius: 4,
    color: t.ink, boxSizing: 'border-box', outline: 'none',
  };
  const labelStyle: CSSProperties = {
    fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, display: 'block', marginBottom: 4,
  };

  return (
    <AppShell navItems={buildNavItems(isAdmin)} releaseTo="/release">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <SectionTitle sub="CONFIGURE YOUR SWITCH">Trigger Settings</SectionTitle>
        <InkButton size="sm" variant={showForm ? 'ghost' : 'primary'} onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ New Switch'}
        </InkButton>
      </div>

      <SketchCard style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, lineHeight: 1.7 }}>
          Choose Heartbeat Mode (check in every N days) or Trip Mode (trigger after a date).
          Configure grace and warning windows for your release cascade.
        </div>
      </SketchCard>

      {error && <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.danger, marginBottom: 12 }}>{error}</p>}

      {showForm && (
        <SketchCard style={{ marginBottom: 20 }}>
          <form onSubmit={handleCreate}>
            <div style={{ fontFamily: "'Caveat',cursive", fontSize: 24, fontWeight: 700, color: t.ink, marginBottom: 14 }}>New Switch</div>
            <input name="name" placeholder="Switch name" value={form.name} onChange={handleChange} required style={inputStyle} />
            <label style={labelStyle}>Mode</label>
            <select name="mode" value={form.mode} onChange={handleChange} style={inputStyle}>
              <option value="heartbeat">Heartbeat — periodic check-in</option>
              <option value="trip">Trip wire — fixed date/time</option>
            </select>
            {form.mode === 'trip' && (
              <>
                <label style={labelStyle}>Trigger at (date/time)</label>
                <input name="triggerAt" type="datetime-local" value={form.triggerAt} onChange={handleChange} style={inputStyle} />
              </>
            )}
            {form.mode === 'heartbeat' && (
              <>
                <label style={labelStyle}>Heartbeat interval (days)</label>
                <input name="heartbeatIntervalDays" type="number" min="1" max="365" value={form.heartbeatIntervalDays} onChange={handleChange} style={inputStyle} />
              </>
            )}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Grace period (hours)</label>
                <input name="gracePeriodHours" type="number" min="1" value={form.gracePeriodHours} onChange={handleChange} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Warning window (days)</label>
                <input name="warningWindowDays" type="number" min="1" value={form.warningWindowDays} onChange={handleChange} style={inputStyle} />
              </div>
            </div>
            {submitError && <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.danger, margin: '4px 0 8px' }}>{submitError}</p>}
            <InkButton type="submit" size="sm" disabled={submitting} ariaBusy={submitting}>{submitting ? 'Creating...' : 'Create Switch'}</InkButton>
          </form>
        </SketchCard>
      )}

      {switches.length === 0 && !showForm ? (
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: t.muted, padding: '24px 0', textAlign: 'center' }}>
          No switches yet.<br />
          <button onClick={() => setShowForm(true)} style={{ background: 'none', border: 'none', color: t.accent, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, marginTop: 6 }}>
            Create your first switch
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {switches.map((sw, i) => (
            <SwitchCard
              key={sw.id}
              sw={sw}
              tilt={i % 2 === 0 ? -0.3 : 0.3}
              t={t}
              readiness={readiness[sw.id]}
              onLoadReadiness={() => loadReadiness(sw.id)}
              onAction={handleAction}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function statusColor(status: string, t: Theme) {
  if (status === 'active') return '#27AE60';
  if (status === 'triggered') return t.danger;
  if (status === 'warning') return '#C77700';
  return t.muted;
}

function SwitchCard({
  sw,
  tilt,
  t,
  readiness,
  onLoadReadiness,
  onAction,
  onDelete,
}: {
  sw: Switch;
  tilt: number;
  t: Theme;
  readiness?: SwitchReadiness;
  onLoadReadiness: () => void;
  onAction: (id: string, action: 'arm' | 'pause' | 'cancel' | 'check-in') => void;
  onDelete: (id: string) => void;
}) {
  return (
    <SketchCard tilt={tilt} style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 24, fontWeight: 700, color: t.ink }}>{sw.name}</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted }}>
            {sw.mode} · <span style={{ color: statusColor(sw.status, t) }}>{sw.status}</span>
          </div>
          {sw.nextCheckInDueAt && (
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: t.muted }}>
              Next check-in: {new Date(sw.nextCheckInDueAt).toLocaleString()}
            </div>
          )}
          {sw.triggerAt && (
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: t.muted }}>
              Trigger at: {new Date(sw.triggerAt).toLocaleString()}
            </div>
          )}
        </div>
        <button onClick={() => onDelete(sw.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.danger, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>Delete</button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {(sw.status === 'draft' || sw.status === 'paused') && (
          <InkButton size="sm" onClick={() => onAction(sw.id, 'arm')}>Arm</InkButton>
        )}
        {sw.status === 'active' && (
          <>
            <InkButton size="sm" onClick={() => onAction(sw.id, 'check-in')}>Check In</InkButton>
            <InkButton size="sm" variant="ghost" onClick={() => onAction(sw.id, 'pause')}>Pause</InkButton>
            <InkButton size="sm" variant="danger" onClick={() => onAction(sw.id, 'cancel')}>Cancel</InkButton>
          </>
        )}
        {sw.status === 'warning' && (
          <>
            <InkButton size="sm" onClick={() => onAction(sw.id, 'check-in')}>Check In</InkButton>
            <InkButton size="sm" variant="danger" onClick={() => onAction(sw.id, 'cancel')}>Cancel</InkButton>
          </>
        )}
      </div>

      {readiness ? (
        <div style={{ borderTop: `1px dashed ${t.border}`, paddingTop: 10 }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, marginBottom: 4 }}>
            Readiness: <span style={{ color: readiness.ready ? '#27AE60' : t.danger }}>{readiness.ready ? 'Ready' : 'Not ready'}</span>
          </div>
          {readiness.checks.map((check) => (
            <div key={check.key} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, display: 'flex', gap: 6, marginBottom: 2 }}>
              <span style={{ color: check.passed ? '#27AE60' : t.danger }}>{check.passed ? '✓' : '✗'}</span>
              <span style={{ color: check.passed ? t.muted : t.ink }}>
                {check.label}{check.message ? ` — ${check.message}` : ''}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <button onClick={onLoadReadiness} style={{ background: 'none', border: 'none', color: t.accent, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
          Check readiness
        </button>
      )}
    </SketchCard>
  );
}
