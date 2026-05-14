// RelayEscrowCard — placeholder for Task 4 (Relay Escrow UI).
// Full escrow configuration (policy acknowledge, material upload, revocation) is
// implemented in the next task. This card surfaces the section header so the page
// layout is complete and users can see the feature is coming.

interface Props {
  connectionId: string;
  label: string | null;
}

export function RelayEscrowCard({ connectionId, label }: Props) {
  return (
    <div className="p-4 bg-brand-surface border border-dashed border-brand-border rounded-lg">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-sans text-sm font-semibold text-brand-ink">
          Relay Escrow
        </h3>
        <span className="font-sans text-xs px-1.5 py-0.5 bg-brand-border text-brand-muted rounded">
          Coming next
        </span>
      </div>
      <p className="font-sans text-xs text-brand-muted">
        Relay Escrow lets{' '}
        <span className="text-brand-ink font-medium">{label ?? connectionId.slice(0, 8)}</span>
        {' '}trigger a release when your Aegis Core instance goes silent.
        Configure encrypted release material, escrow contacts, and release policy
        in the next setup step.
      </p>
    </div>
  );
}
