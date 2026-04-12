// Client module for the leaflet URL-shortener service.
// All cross-origin requests use credentials: 'include' (session cookie).
// CSRF token is fetched lazily, cached in memory, and invalidated on 403.

export type SessionResult =
  | { status: 'anonymous' }
  | { status: 'authenticated'; username: string }
  | { status: 'rate-limited'; retryAfter: number | null }
  | { status: 'unavailable' };

export interface ShortenTtlOption {
  value: string;
  label: string;
}

export interface LeafletCapabilities {
  authenticated: boolean;
  shortenAllowed: boolean;
  aliasingAllowed: boolean;
  neverAllowed: boolean;
  ttlOptions: ShortenTtlOption[];
}

export type ShortenError =
  | { type: 'validation'; message: string }
  | { type: 'conflict'; message: string }
  | { type: 'forbidden'; message: string }
  | { type: 'rate-limited'; message: string; retryAfter: number | null }
  | { type: 'unavailable'; message: string };

export type ShortenResult =
  | { ok: true; shortUrl: string }
  | { ok: false; error: ShortenError };

// ── localStorage key ────────────────────────────────────────
const STORAGE_KEY = 'leaflet.optedIn';

// ── CSRF token cache ────────────────────────────────────────
let _csrfToken: string | null = null;

// ── Helpers ─────────────────────────────────────────────────

function getApiOrigin(): string {
  return (
    (import.meta.env.VITE_LEAFLET_API_ORIGIN as string | undefined) ||
    'https://leaflet.lair.nntin.xyz'
  );
}

function parseRetryAfter(res: Response): number | null {
  const val = res.headers.get('Retry-After');
  if (!val) return null;
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : null;
}

// ── Opt-in persistence ───────────────────────────────────────

export function isLeafletOptedIn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setLeafletOptIn(value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // storage blocked — ignore
  }
}

// ── CSRF ─────────────────────────────────────────────────────

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch(`${getApiOrigin()}/auth/csrf-token`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`CSRF fetch failed: ${res.status}`);
  const data = (await res.json()) as { csrfToken: string };
  _csrfToken = data.csrfToken;
  return _csrfToken;
}

async function getCsrfToken(): Promise<string> {
  return _csrfToken ?? fetchCsrfToken();
}

function invalidateCsrfToken(): void {
  _csrfToken = null;
}

// ── Session ──────────────────────────────────────────────────

export async function getLeafletSession(): Promise<SessionResult> {
  try {
    const res = await fetch(`${getApiOrigin()}/auth/me`, {
      credentials: 'include',
    });
    if (res.status === 429) {
      return { status: 'rate-limited', retryAfter: parseRetryAfter(res) };
    }
    if (!res.ok) return { status: 'unavailable' };
    const user = (await res.json()) as { username: string } | null;
    return user === null
      ? { status: 'anonymous' }
      : { status: 'authenticated', username: user.username };
  } catch {
    return { status: 'unavailable' };
  }
}

// ── Capabilities ─────────────────────────────────────────────

export async function getLeafletCapabilities(): Promise<LeafletCapabilities | null> {
  try {
    const res = await fetch(`${getApiOrigin()}/api/shorten/capabilities`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    return (await res.json()) as LeafletCapabilities;
  } catch {
    return null;
  }
}

// ── Logout ───────────────────────────────────────────────────

export async function logoutLeafletSession(): Promise<void> {
  try {
    const csrfToken = await getCsrfToken();
    await fetch(`${getApiOrigin()}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
    });
    invalidateCsrfToken();
  } catch {
    // logout is best-effort
  }
}

// ── Login URL ────────────────────────────────────────────────

export function buildLeafletLoginUrl(returnTo: string): string {
  const origin = getApiOrigin();
  const base = origin || window.location.origin;
  const url = new URL('/login', base);
  url.searchParams.set('returnTo', returnTo);
  return url.toString();
}

// ── Shorten ──────────────────────────────────────────────────

async function doShortenRequest(
  url: string,
  ttl: string,
  csrfToken: string,
): Promise<Response> {
  return fetch(`${getApiOrigin()}/api/shorten`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ url, ttl }),
  });
}

async function parseShortenResponse(res: Response): Promise<ShortenResult> {
  if (res.status === 429) {
    return {
      ok: false,
      error: {
        type: 'rate-limited',
        message: 'Too many requests.',
        retryAfter: parseRetryAfter(res),
      },
    };
  }
  if (res.status === 400) {
    const data = (await res.json().catch(() => ({}))) as {
      errors?: Array<{ msg: string }>;
    };
    return {
      ok: false,
      error: {
        type: 'validation',
        message: data.errors?.[0]?.msg ?? 'Invalid request.',
      },
    };
  }
  if (res.status === 409) {
    return { ok: false, error: { type: 'conflict', message: 'Alias already in use.' } };
  }
  if (res.status === 403) {
    return { ok: false, error: { type: 'forbidden', message: 'CSRF check failed.' } };
  }
  if (!res.ok) {
    return { ok: false, error: { type: 'unavailable', message: 'Service unavailable.' } };
  }
  const data = (await res.json()) as { shortUrl: string };
  return { ok: true, shortUrl: data.shortUrl };
}

export async function shortenUrl(url: string, ttl: string): Promise<ShortenResult> {
  try {
    let csrfToken = await getCsrfToken();
    let res = await doShortenRequest(url, ttl, csrfToken);

    // 403 may mean a stale CSRF token — invalidate and retry once
    if (res.status === 403) {
      invalidateCsrfToken();
      csrfToken = await fetchCsrfToken();
      res = await doShortenRequest(url, ttl, csrfToken);
    }

    return parseShortenResponse(res);
  } catch {
    return {
      ok: false,
      error: { type: 'unavailable', message: 'Could not connect to shortener.' },
    };
  }
}
