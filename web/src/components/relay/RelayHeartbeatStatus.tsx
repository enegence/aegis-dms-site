interface Props {
  lastHeartbeatAt: string | null;
  status: string;
}

function heartbeatLabel(lastHeartbeatAt: string | null, status: string): {
  label: string;
  color: string;
} {
  if (status === 'disconnected') {
    return { label: 'Revoked', color: 'text-brand-muted line-through' };
  }

  if (!lastHeartbeatAt) {
    return { label: 'No heartbeat yet', color: 'text-brand-muted' };
  }

  const last = new Date(lastHeartbeatAt);
  const ageMs = Date.now() - last.getTime();
  const ageMins = ageMs / 1000 / 60;

  if (ageMins < 15) {
    return { label: 'Online', color: 'text-brand-success' };
  }
  if (ageMins < 60) {
    return { label: `Last seen ${Math.round(ageMins)}m ago`, color: 'text-yellow-600' };
  }
  const ageH = ageMins / 60;
  if (ageH < 24) {
    return { label: `Last seen ${Math.round(ageH)}h ago`, color: 'text-brand-danger' };
  }
  return { label: `Last seen ${last.toLocaleDateString()}`, color: 'text-brand-danger' };
}

export function RelayHeartbeatStatus({ lastHeartbeatAt, status }: Props) {
  const { label, color } = heartbeatLabel(lastHeartbeatAt, status);
  return (
    <span className={`font-sans text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
