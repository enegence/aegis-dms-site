import { useEffect, useState, type CSSProperties } from 'react';
import {
  listEstateItems,
  createEstateItem,
  deleteEstateItem,
  type EstateItem,
} from '../../lib/estate';
import { useAuth } from '../../App';
import { useTheme } from '../../lib/theme';
import AppShell from '../../components/layout/AppShell';
import { buildNavItems } from '../../components/layout/navModel';
import { SketchCard, SectionTitle, InkButton } from '../../components/ui';

const CATEGORIES = [
  'bank_account',
  'investment',
  'crypto',
  'real_estate',
  'insurance',
  'vehicle',
  'digital_asset',
  'document',
  'other',
];

const emptyForm = {
  category: '',
  title: '',
  institutionName: '',
  accountType: '',
  referenceHint: '',
  assetDescription: '',
  locationNotes: '',
  executorNotes: '',
};

export default function Estate() {
  const { user } = useAuth();
  const t = useTheme();
  const [items, setItems] = useState<EstateItem[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    listEstateItems()
      .then((r) => setItems(r.items))
      .catch((e: Error) => setError(e.message));
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      const result = await createEstateItem({
        category: form.category,
        title: form.title,
        institutionName: form.institutionName || undefined,
        accountType: form.accountType || undefined,
        referenceHint: form.referenceHint || undefined,
        assetDescription: form.assetDescription || undefined,
        locationNotes: form.locationNotes || undefined,
        executorNotes: form.executorNotes || undefined,
      });
      setItems((prev) => [...prev, result.item]);
      setShowForm(false);
      setForm(emptyForm);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to create item');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this estate item? This cannot be undone.')) return;
    try {
      await deleteEstateItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'sa';
  const catItems = items.filter((i) => i.category === activeCategory);

  const inputStyle: CSSProperties = {
    width: '100%', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, padding: '8px 10px',
    marginBottom: 8, background: t.bg, border: `1.5px solid ${t.border}`, borderRadius: 4,
    color: t.ink, boxSizing: 'border-box', outline: 'none',
  };

  return (
    <AppShell navItems={buildNavItems(isAdmin)} releaseTo="/release">
      <SectionTitle sub="WHAT YOUR PEOPLE NEED TO FIND">Legacy Packet</SectionTitle>

      <SketchCard style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.muted, lineHeight: 1.7 }}>
          Sensitive estate and contact details are encrypted at rest. Aegis Hosted is a managed
          service and requires trusting Aegis SaaS with server-side encryption for v1.
        </div>
      </SketchCard>

      {error && <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.danger, marginBottom: 12 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {/* Category list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 170 }}>
          {CATEGORIES.map((cat) => {
            const count = items.filter((i) => i.category === cat).length;
            const active = cat === activeCategory;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  fontFamily: "'Caveat',cursive", fontSize: 18, fontWeight: active ? 700 : 400,
                  padding: '8px 14px', textAlign: 'left',
                  background: active ? t.ink : 'transparent',
                  color: active ? t.bg : t.ink,
                  border: `2px solid ${active ? t.ink : t.border}`,
                  borderRadius: '3px 8px 3px 8px / 8px 3px 8px 3px',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  transform: active ? 'rotate(0.3deg)' : 'none', transition: 'all 0.1s',
                }}
              >
                {cat.replace(/_/g, ' ')}
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, background: active ? t.bg : t.border, color: active ? t.ink : t.muted, borderRadius: 99, padding: '1px 7px', minWidth: 18, textAlign: 'center' }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Items panel */}
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {catItems.length === 0 && !showForm && (
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: t.muted, padding: '24px 0', textAlign: 'center' }}>
                Nothing here yet.<br />Add an item to get started.
              </div>
            )}
            {catItems.map((item, i) => (
              <SketchCard key={item.id} tilt={i % 2 === 0 ? 0.2 : -0.2} style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22, fontWeight: 700, color: t.ink }}>{item.title}</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: t.accent, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '2px 0 0' }}>
                      {item.category.replace(/_/g, ' ')}{item.institutionName ? ` · ${item.institutionName}` : ''}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.danger, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                    Delete
                  </button>
                </div>
              </SketchCard>
            ))}

            {showForm ? (
              <SketchCard>
                <form onSubmit={handleCreate}>
                  <div style={{ fontFamily: "'Caveat',cursive", fontSize: 20, fontWeight: 700, color: t.ink, marginBottom: 12 }}>New Estate Item</div>
                  <select name="category" value={form.category} onChange={handleChange} required style={inputStyle}>
                    <option value="">Select category</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <input name="title" placeholder="Title (e.g. Main Checking Account)" value={form.title} onChange={handleChange} required style={inputStyle} />
                  <input name="institutionName" placeholder="Institution name (optional)" value={form.institutionName} onChange={handleChange} style={inputStyle} />
                  <input name="accountType" placeholder="Account type (optional)" value={form.accountType} onChange={handleChange} style={inputStyle} />
                  <input name="referenceHint" placeholder="Reference hint (optional, e.g. last 4 digits)" value={form.referenceHint} onChange={handleChange} style={inputStyle} />
                  <textarea name="assetDescription" placeholder="Asset description (optional)" value={form.assetDescription} onChange={handleChange} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                  <textarea name="locationNotes" placeholder="Location notes (optional)" value={form.locationNotes} onChange={handleChange} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                  <textarea name="executorNotes" placeholder="Executor notes (optional)" value={form.executorNotes} onChange={handleChange} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                  {submitError && <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.danger, marginBottom: 8 }}>{submitError}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <InkButton type="submit" size="sm" disabled={submitting} ariaBusy={submitting}>{submitting ? 'Saving...' : 'Save Item'}</InkButton>
                    <InkButton size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</InkButton>
                  </div>
                </form>
              </SketchCard>
            ) : (
              <InkButton variant="ghost" size="sm" onClick={() => { setForm({ ...emptyForm, category: activeCategory }); setShowForm(true); }} style={{ alignSelf: 'flex-start' }}>
                + Add {activeCategory.replace(/_/g, ' ')} Item
              </InkButton>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
