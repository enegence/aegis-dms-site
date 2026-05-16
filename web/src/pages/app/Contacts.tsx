import { useEffect, useState, type CSSProperties } from 'react';
import {
  listContacts,
  createContact,
  deleteContact,
  type Contact,
} from '../../lib/contacts';
import { useAuth } from '../../App';
import { useTheme } from '../../lib/theme';
import AppShell from '../../components/layout/AppShell';
import { buildNavItems } from '../../components/layout/navModel';
import { SketchCard, SectionTitle, InkButton } from '../../components/ui';

const emptyForm = {
  fullName: '',
  email: '',
  relationship: '',
  phone: '',
  telegramHandle: '',
  confirmationWindowHours: '24',
};

export default function Contacts() {
  const { user } = useAuth();
  const t = useTheme();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    listContacts()
      .then((r) => setContacts(r.contacts))
      .catch((e: Error) => setError(e.message));
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      const result = await createContact({
        fullName: form.fullName,
        email: form.email,
        relationship: form.relationship || undefined,
        phone: form.phone || undefined,
        telegramHandle: form.telegramHandle || undefined,
        confirmationWindowHours: parseInt(form.confirmationWindowHours, 10) || 24,
      });
      setContacts((prev) => [...prev, result.contact]);
      setShowForm(false);
      setForm(emptyForm);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to create contact');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this contact? This cannot be undone.')) return;
    try {
      await deleteContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'sa';
  const ordered = [...contacts].sort((a, b) => a.priorityOrder - b.priorityOrder);

  const inputStyle: CSSProperties = {
    width: '100%', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, padding: '8px 10px',
    marginBottom: 8, background: t.bg, border: `1.5px solid ${t.border}`, borderRadius: 4,
    color: t.ink, boxSizing: 'border-box', outline: 'none',
  };

  return (
    <AppShell navItems={buildNavItems(isAdmin)} releaseTo="/release">
      <SectionTitle sub="WHO GETS NOTIFIED, AND WHEN">Contact Cascade</SectionTitle>

      <SketchCard style={{ marginBottom: 20, padding: '12px 16px' }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, lineHeight: 1.7 }}>
          Contacts are notified in priority order. Each receives an encrypted claim link.<br />
          They must verify identity before unlocking the legacy packet.
        </div>
      </SketchCard>

      {error && <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.danger, marginBottom: 12 }}>{error}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {ordered.length === 0 && !showForm && (
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: t.muted, padding: '24px 0', textAlign: 'center' }}>
            No contacts yet.<br />Add your first trusted contact.
          </div>
        )}
        {ordered.map((c, i) => (
          <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 32 }}>
              <span style={{ fontFamily: "'Caveat',cursive", fontSize: 28, fontWeight: 700, color: t.accent, lineHeight: 1 }}>{c.priorityOrder}</span>
            </div>
            <SketchCard tilt={i % 2 === 0 ? 0.3 : -0.2} style={{ flex: 1, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: "'Caveat',cursive", fontSize: 24, fontWeight: 700, color: t.ink, lineHeight: 1 }}>{c.fullName}</div>
                  {c.relationship && (
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: t.accent, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '3px 0 8px' }}>{c.relationship}</div>
                  )}
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted }}>
                    {c.email}{c.phone ? ` · ${c.phone}` : ''}
                  </div>
                </div>
                <button onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.muted, fontSize: 16, padding: 4, opacity: 0.5 }} aria-label={`Remove ${c.fullName}`}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: t.muted }}>
                  {c.confirmationWindowHours}H WINDOW
                </span>
                {['email', c.phone ? 'sms' : null, c.telegramHandle ? 'telegram' : null].filter(Boolean).map((n) => (
                  <span key={n as string} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, background: t.border, color: t.ink, borderRadius: 99, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{n}</span>
                ))}
              </div>
            </SketchCard>
          </div>
        ))}
      </div>

      {showForm ? (
        <SketchCard>
          <form onSubmit={handleCreate}>
            <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22, fontWeight: 700, color: t.ink, marginBottom: 12 }}>Add Trusted Contact</div>
            <input name="fullName" placeholder="Full name" value={form.fullName} onChange={handleChange} required style={inputStyle} />
            <input name="email" type="email" placeholder="Email address" value={form.email} onChange={handleChange} required style={inputStyle} />
            <input name="relationship" placeholder="Relationship (e.g. spouse, sibling, attorney)" value={form.relationship} onChange={handleChange} style={inputStyle} />
            <input name="phone" type="tel" placeholder="Phone (optional)" value={form.phone} onChange={handleChange} style={inputStyle} />
            <input name="telegramHandle" placeholder="Telegram handle (optional)" value={form.telegramHandle} onChange={handleChange} style={inputStyle} />
            <label style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, display: 'block', marginBottom: 4 }}>
              Confirmation window (hours)
            </label>
            <input name="confirmationWindowHours" type="number" min="1" max="720" value={form.confirmationWindowHours} onChange={handleChange} style={inputStyle} />
            {submitError && <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.danger, margin: '4px 0 8px' }}>{submitError}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <InkButton type="submit" size="sm" disabled={submitting} ariaBusy={submitting}>{submitting ? 'Saving...' : 'Save Contact'}</InkButton>
              <InkButton size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</InkButton>
            </div>
          </form>
        </SketchCard>
      ) : (
        <InkButton variant="ghost" size="sm" onClick={() => setShowForm(true)}>+ Add Contact</InkButton>
      )}
    </AppShell>
  );
}
