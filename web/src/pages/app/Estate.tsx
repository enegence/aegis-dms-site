import { useEffect, useState } from 'react';
import {
  listEstateItems,
  createEstateItem,
  deleteEstateItem,
  type EstateItem,
} from '../../lib/estate';

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
  const [items, setItems] = useState<EstateItem[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
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

  return (
    <div className="min-h-screen bg-brand-bg p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-hand text-4xl font-bold text-brand-ink">Estate Items</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="font-sans font-semibold text-sm px-4 py-2 bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add Item'}
          </button>
        </div>

        <p className="font-sans text-xs text-brand-muted mb-6 p-3 bg-brand-surface border border-brand-border rounded">
          Sensitive estate and contact details are encrypted at rest. Aegis Hosted is a managed
          service and requires trusting Aegis SaaS with server-side encryption for v1.
        </p>

        {error && <p className="font-sans text-sm text-brand-danger mb-4">{error}</p>}

        {/* Add form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-6 p-6 bg-brand-surface border-2 border-brand-border rounded-lg"
          >
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-4">New Estate Item</h2>

            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              required
              className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
            >
              <option value="">Select category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, ' ')}
                </option>
              ))}
            </select>

            <input
              name="title"
              placeholder="Title (e.g. Main Checking Account)"
              value={form.title}
              onChange={handleChange}
              required
              className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
            />
            <input
              name="institutionName"
              placeholder="Institution name (optional)"
              value={form.institutionName}
              onChange={handleChange}
              className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
            />
            <input
              name="accountType"
              placeholder="Account type (optional)"
              value={form.accountType}
              onChange={handleChange}
              className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
            />
            <input
              name="referenceHint"
              placeholder="Reference hint (optional, e.g. last 4 digits)"
              value={form.referenceHint}
              onChange={handleChange}
              className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
            />
            <textarea
              name="assetDescription"
              placeholder="Asset description (optional)"
              value={form.assetDescription}
              onChange={handleChange}
              rows={2}
              className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent resize-none"
            />
            <textarea
              name="locationNotes"
              placeholder="Location notes (optional)"
              value={form.locationNotes}
              onChange={handleChange}
              rows={2}
              className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent resize-none"
            />
            <textarea
              name="executorNotes"
              placeholder="Executor notes (optional)"
              value={form.executorNotes}
              onChange={handleChange}
              rows={2}
              className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent resize-none"
            />

            {submitError && (
              <p className="font-sans text-sm text-brand-danger mb-3">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full font-sans font-semibold text-sm p-3 cursor-pointer bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Item'}
            </button>
          </form>
        )}

        {/* Item list */}
        {items.length === 0 && !showForm ? (
          <div className="p-6 bg-brand-surface border border-dashed border-brand-border rounded-lg text-center">
            <p className="font-sans text-sm text-brand-muted">No estate items yet.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-2 font-sans text-sm text-brand-accent hover:underline"
            >
              Add your first item
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="p-4 bg-brand-surface border border-brand-border rounded-lg flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm font-semibold text-brand-ink truncate">
                    {item.title}
                  </p>
                  <p className="font-sans text-xs text-brand-muted">
                    {item.category.replace(/_/g, ' ')}
                    {item.institutionName ? ` · ${item.institutionName}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="font-sans text-xs text-brand-danger hover:underline flex-shrink-0"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
