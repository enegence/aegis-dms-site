import { useEffect, useState } from 'react';
import {
  listContacts,
  createContact,
  deleteContact,
  type Contact,
} from '../../lib/contacts';

const emptyForm = {
  fullName: '',
  email: '',
  relationship: '',
  phone: '',
  telegramHandle: '',
  confirmationWindowHours: '24',
};

export default function Contacts() {
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

  return (
    <div className="min-h-screen bg-brand-bg p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-hand text-4xl font-bold text-brand-ink">Contacts</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="font-sans font-semibold text-sm px-4 py-2 bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add Contact'}
          </button>
        </div>

        {error && <p className="font-sans text-sm text-brand-danger mb-4">{error}</p>}

        {/* Add form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-6 p-6 bg-brand-surface border-2 border-brand-border rounded-lg"
          >
            <h2 className="font-hand text-2xl font-bold text-brand-ink mb-4">New Contact</h2>

            <input
              name="fullName"
              placeholder="Full name"
              value={form.fullName}
              onChange={handleChange}
              required
              className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
            />
            <input
              name="email"
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
            />
            <input
              name="relationship"
              placeholder="Relationship (e.g. spouse, sibling, attorney)"
              value={form.relationship}
              onChange={handleChange}
              className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
            />
            <input
              name="phone"
              type="tel"
              placeholder="Phone (optional)"
              value={form.phone}
              onChange={handleChange}
              className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
            />
            <input
              name="telegramHandle"
              placeholder="Telegram handle (optional)"
              value={form.telegramHandle}
              onChange={handleChange}
              className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
            />
            <div className="mb-4">
              <label className="font-sans text-xs text-brand-muted block mb-1">
                Confirmation window (hours)
              </label>
              <input
                name="confirmationWindowHours"
                type="number"
                min="1"
                max="720"
                value={form.confirmationWindowHours}
                onChange={handleChange}
                className="w-full font-sans text-sm p-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
              />
            </div>

            {submitError && (
              <p className="font-sans text-sm text-brand-danger mb-3">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full font-sans font-semibold text-sm p-3 cursor-pointer bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Contact'}
            </button>
          </form>
        )}

        {/* Contact list */}
        {contacts.length === 0 && !showForm ? (
          <div className="p-6 bg-brand-surface border border-dashed border-brand-border rounded-lg text-center">
            <p className="font-sans text-sm text-brand-muted">No contacts yet.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-2 font-sans text-sm text-brand-accent hover:underline"
            >
              Add your first contact
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {contacts.map((contact) => (
              <li
                key={contact.id}
                className="p-4 bg-brand-surface border border-brand-border rounded-lg flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm font-semibold text-brand-ink truncate">
                    {contact.fullName}
                  </p>
                  <p className="font-sans text-xs text-brand-muted truncate">
                    {contact.email}
                    {contact.relationship ? ` · ${contact.relationship}` : ''}
                  </p>
                  <p className="font-sans text-xs text-brand-muted">
                    Priority {contact.priorityOrder} · {contact.confirmationWindowHours}h window
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(contact.id)}
                  className="font-sans text-xs text-brand-danger hover:underline flex-shrink-0"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
