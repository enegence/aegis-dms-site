const BASE = '';

// ── Claim portal types ─────────────────────────────────────────────────────────

export type ClaimStatus = {
  id: string;
  status: string;
  expiresAt: string | null;
  notifiedAt: string | null;
  openedAt: string | null;
  verifiedAt: string | null;
  acceptedAt: string | null;
  packetDownloadedAt: string | null;
  keyViewedAt: string | null;
  acknowledgedAt: string | null;
  ownerDisplayName: string | null;
};

export type ReleaseMaterial = {
  keyId: string | null;
  encryptionAlgorithm: string | null;
  packetKey: string;
  encoding: string;
};

let csrfToken: string | null = null;

export function clearCsrfToken() {
  csrfToken = null;
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const res = await fetch('/api/csrf', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch CSRF token');
  const data = await res.json();
  csrfToken = data.csrfToken;
  return csrfToken!;
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = options.method?.toUpperCase() || 'GET';
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (isMutating) {
    try {
      const token = await getCsrfToken();
      headers['X-CSRF-Token'] = token;
    } catch {
      // Proceed without CSRF token for pre-auth endpoints (login, register)
    }
  }

  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const put = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export const del = <T>(path: string) =>
  api<T>(path, { method: 'DELETE' });

// ── Claim portal API ───────────────────────────────────────────────────────────

export const getClaimStatus = (token: string) =>
  get<ClaimStatus>(`/api/claim/${token}`);

export const openClaim = (token: string) =>
  post<ClaimStatus>(`/api/claim/${token}/open`, {});

export const verifyClaim = (token: string, pin?: string) =>
  post<ClaimStatus>(`/api/claim/${token}/verify`, pin ? { pin } : {});

export const acceptClaim = (token: string) =>
  post<ClaimStatus>(`/api/claim/${token}/accept`, {});

export const viewClaimKey = (token: string) =>
  post<ClaimStatus & { releaseMaterial: ReleaseMaterial }>(`/api/claim/${token}/key-view`, {});

export const acknowledgeClaimToken = (token: string) =>
  post<ClaimStatus>(`/api/claim/${token}/acknowledge`, {});

export async function downloadClaimPacket(token: string): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`/api/claim/${token}/packet`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Request failed: ${res.status}`);
  }
  const cd = res.headers.get('Content-Disposition') ?? '';
  const match = cd.match(/filename="(.+?)"/);
  const filename = match?.[1] ?? 'aegis-packet.aegis.enc';
  const blob = await res.blob();
  return { blob, filename };
}
