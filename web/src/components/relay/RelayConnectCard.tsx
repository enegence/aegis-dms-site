import { useState } from 'react';
import { post } from '../../lib/api';

interface LinkStartResponse {
  code: string;
  linkCodeId: string;
  exchangeUrl: string;
  instructions: string[];
}

interface Props {
  onConnected: () => void;
  onCancel: () => void;
}

export function RelayConnectCard({ onConnected, onCancel }: Props) {
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [callbackUrl, setCallbackUrl] = useState('http://localhost:3000');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [linkResult, setLinkResult] = useState<LinkStartResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Generate a random state value for CSRF protection on the exchange
  const [state] = useState(() =>
    Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
  );

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await post<LinkStartResponse>('/api/relay/link/start', {
        callbackUrl,
        state,
        label: label || undefined,
      });
      setLinkResult(result);
      setStep('code');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate link code');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCode() {
    if (!linkResult) return;
    await navigator.clipboard.writeText(linkResult.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (step === 'code' && linkResult) {
    return (
      <div className="mb-6 p-6 bg-brand-surface border-2 border-brand-border rounded-lg">
        <h2 className="font-hand text-2xl font-bold text-brand-ink mb-2">
          Link Code Generated
        </h2>
        <p className="font-sans text-xs text-brand-muted mb-4">
          This code expires in 10 minutes and can only be used once.
        </p>

        <div className="mb-4 p-3 bg-brand-bg border border-brand-border rounded">
          <p className="font-sans text-xs text-brand-muted font-semibold mb-1">
            Step 1 — Copy this code:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs text-brand-ink bg-white border border-brand-border rounded p-2 break-all select-all">
              {linkResult.code}
            </code>
            <button
              onClick={copyCode}
              className="font-sans text-xs px-3 py-2 bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors flex-shrink-0"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="mb-4 p-3 bg-brand-bg border border-brand-border rounded">
          <p className="font-sans text-xs text-brand-muted font-semibold mb-1">
            Step 2 — In Aegis Core settings, paste the code and set:
          </p>
          <code className="block font-mono text-xs text-brand-ink break-all">
            relay_endpoint = {linkResult.exchangeUrl}
          </code>
        </div>

        <div className="mb-4 p-3 bg-brand-bg border border-brand-border rounded">
          <p className="font-sans text-xs text-brand-muted font-semibold mb-1">
            Or run this curl command on your self-hosted server:
          </p>
          <code className="block font-mono text-xs text-brand-ink break-all whitespace-pre-wrap">
            {`curl -X POST ${linkResult.exchangeUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"code":"${linkResult.code}","state":"${state}"}'`}
          </code>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => { onConnected(); }}
            className="font-sans text-xs px-4 py-2 bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors"
          >
            Done — refresh connections
          </button>
          <button
            onClick={onCancel}
            className="font-sans text-xs px-4 py-2 border border-brand-border text-brand-muted rounded hover:border-brand-ink transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleStart}
      className="mb-6 p-6 bg-brand-surface border-2 border-brand-border rounded-lg"
    >
      <h2 className="font-hand text-2xl font-bold text-brand-ink mb-4">
        Connect Self-Hosted Instance
      </h2>
      <p className="font-sans text-xs text-brand-muted mb-4">
        This generates a secure one-time code. Your API key is never sent in a URL —
        your Aegis Core instance exchanges the code for a key server-to-server.
      </p>

      <label className="font-sans text-xs text-brand-muted block mb-1">
        Your Aegis Core URL (for reference)
      </label>
      <input
        type="url"
        placeholder="http://localhost:3000"
        value={callbackUrl}
        onChange={(e) => setCallbackUrl(e.target.value)}
        required
        className="w-full font-sans text-sm p-3 mb-3 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
      />

      <label className="font-sans text-xs text-brand-muted block mb-1">
        Connection label (optional)
      </label>
      <input
        type="text"
        placeholder="e.g. Home Server, Raspberry Pi"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="w-full font-sans text-sm p-3 mb-4 rounded border border-brand-border bg-brand-bg text-brand-ink outline-none focus:border-brand-accent"
      />

      {error && (
        <p className="font-sans text-sm text-brand-danger mb-3">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 font-sans font-semibold text-sm p-3 cursor-pointer bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors disabled:opacity-50"
        >
          {submitting ? 'Generating...' : 'Generate Link Code'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-sans text-sm px-4 py-3 border border-brand-border text-brand-muted rounded hover:border-brand-ink transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
