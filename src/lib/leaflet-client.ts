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
  anonymous?: boolean;
  authenticated: boolean;
  role?: string;
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

export interface ShortenSuccessResult {
  ok: true;
  shortUrl: string;
  expiresAt: number | null;
  cached: boolean;
}

export type ShortenResult =
  | ShortenSuccessResult
  | { ok: false; error: ShortenError };

// ── localStorage key ────────────────────────────────────────
const STORAGE_KEY = 'leaflet.optedIn';
const SHORTEN_CACHE_KEY = 'leaflet.shortenCache.v1';
const MAX_SHORTEN_CACHE_ENTRIES = 20;

// ── CSRF token cache ────────────────────────────────────────
let _csrfToken: string | null = null;
let _sessionCache: SessionResult | null = null;
let _sessionPromise: Promise<SessionResult> | null = null;
let _capabilitiesCache: LeafletCapabilities | null | undefined;
let _capabilitiesPromise: Promise<LeafletCapabilities | null> | null = null;

interface CachedShortUrlEntry {
  scope: string;
  longUrl: string;
  ttl: string;
  shortUrl: string;
  expiresAt: number | null;
  savedAt: number;
}

// ── Helpers ─────────────────────────────────────────────────

function getApiOrigin(): string {
  return (
    (import.meta.env.VITE_LEAFLET_API_ORIGIN as string | undefined) ||
    'https://leaflet.lair.nntin.xyz'
  );
}

function getFrontendOrigin(): string {
  const base =
    (import.meta.env.VITE_LEAFLET_FRONTEND_ORIGIN as string | undefined) ||
    'https://nntin.xyz/leaflet/';

  return base.endsWith('/') ? base : `${base}/`;
}

function parseRetryAfter(res: Response): number | null {
  const val = res.headers.get('Retry-After');
  if (!val) return null;
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : null;
}

function parseTtlToMs(ttl: string): number | null {
  if (ttl === 'never') return null;

  const match = ttl.match(/^(\d+)([mhdw])$/);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  switch (match[2]) {
    case 'm': return amount * 60_000;
    case 'h': return amount * 3_600_000;
    case 'd': return amount * 86_400_000;
    case 'w': return amount * 604_800_000;
    default: return null;
  }
}

function computeExpiresAt(ttl: string): number | null {
  if (ttl === 'never') return null;
  const ttlMs = parseTtlToMs(ttl);
  return ttlMs === null ? null : Date.now() + ttlMs;
}

function readShortenCache(): Record<string, CachedShortUrlEntry> {
  try {
    const raw = localStorage.getItem(SHORTEN_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, CachedShortUrlEntry> : {};
  } catch {
    return {};
  }
}

function writeShortenCache(entries: Record<string, CachedShortUrlEntry>): void {
  try {
    localStorage.setItem(SHORTEN_CACHE_KEY, JSON.stringify(entries));
  } catch {
    // storage blocked or full — ignore
  }
}

function makeShortenCacheKey(scope: string, longUrl: string, ttl: string): string {
  return JSON.stringify([scope, ttl, longUrl]);
}

function pruneShortenCache(
  entries: Record<string, CachedShortUrlEntry>,
): Record<string, CachedShortUrlEntry> {
  const now = Date.now();
  const prunedEntries = Object.entries(entries)
    .filter(([, entry]) => entry.expiresAt === null || entry.expiresAt > now)
    .sort(([, a], [, b]) => b.savedAt - a.savedAt)
    .slice(0, MAX_SHORTEN_CACHE_ENTRIES);

  return Object.fromEntries(prunedEntries);
}

function getCachedShortUrl(scope: string, longUrl: string, ttl: string): CachedShortUrlEntry | null {
  const entries = pruneShortenCache(readShortenCache());
  const key = makeShortenCacheKey(scope, longUrl, ttl);
  const entry = entries[key] ?? null;

  if (Object.keys(entries).length !== Object.keys(readShortenCache()).length) {
    writeShortenCache(entries);
  }

  return entry;
}

function setCachedShortUrl(
  scope: string,
  longUrl: string,
  ttl: string,
  shortUrl: string,
  expiresAt: number | null,
): void {
  const entries = pruneShortenCache(readShortenCache());
  entries[makeShortenCacheKey(scope, longUrl, ttl)] = {
    scope,
    longUrl,
    ttl,
    shortUrl,
    expiresAt,
    savedAt: Date.now(),
  };
  writeShortenCache(pruneShortenCache(entries));
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

export function clearLeafletSessionCache(): void {
  _sessionCache = null;
  _sessionPromise = null;
}

export function clearLeafletCapabilitiesCache(): void {
  _capabilitiesCache = undefined;
  _capabilitiesPromise = null;
}

export function clearLeafletConnectionCaches(): void {
  clearLeafletSessionCache();
  clearLeafletCapabilitiesCache();
}

// ── Session ──────────────────────────────────────────────────

export async function getLeafletSession(options?: { force?: boolean }): Promise<SessionResult> {
  if (!options?.force) {
    if (_sessionCache !== null) return _sessionCache;
    if (_sessionPromise) return _sessionPromise;
  } else {
    clearLeafletSessionCache();
  }

  _sessionPromise = (async () => {
    try {
      const res = await fetch(`${getApiOrigin()}/auth/me`, {
        credentials: 'include',
      });
      if (res.status === 429) {
        return { status: 'rate-limited', retryAfter: parseRetryAfter(res) } satisfies SessionResult;
      }
      if (!res.ok) return { status: 'unavailable' } satisfies SessionResult;
      const user = (await res.json()) as { username: string } | null;
      return user === null
        ? ({ status: 'anonymous' } satisfies SessionResult)
        : ({ status: 'authenticated', username: user.username } satisfies SessionResult);
    } catch {
      return { status: 'unavailable' } satisfies SessionResult;
    }
  })();

  try {
    const result = await _sessionPromise;
    _sessionCache = result;
    return result;
  } finally {
    _sessionPromise = null;
  }
}

// ── Capabilities ─────────────────────────────────────────────

export async function getLeafletCapabilities(
  options?: { force?: boolean },
): Promise<LeafletCapabilities | null> {
  if (!options?.force) {
    if (_capabilitiesCache !== undefined) return _capabilitiesCache;
    if (_capabilitiesPromise) return _capabilitiesPromise;
  } else {
    clearLeafletCapabilitiesCache();
  }

  _capabilitiesPromise = (async () => {
    try {
      const res = await fetch(`${getApiOrigin()}/api/shorten/capabilities`, {
        credentials: 'include',
      });
      if (!res.ok) return null;
      return (await res.json()) as LeafletCapabilities;
    } catch {
      return null;
    }
  })();

  try {
    const result = await _capabilitiesPromise;
    _capabilitiesCache = result;
    return result;
  } finally {
    _capabilitiesPromise = null;
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
  } finally {
    clearLeafletConnectionCaches();
  }
}

// ── Login URL ────────────────────────────────────────────────

export function buildLeafletLoginUrl(returnTo: string): string {
  const url = new URL('login', getFrontendOrigin());
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

async function parseShortenResponse(res: Response, ttl: string): Promise<ShortenResult> {
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
  return {
    ok: true,
    shortUrl: data.shortUrl,
    expiresAt: computeExpiresAt(ttl),
    cached: false,
  };
}

export async function shortenUrl(
  url: string,
  ttl: string,
  options?: { cacheScope?: string },
): Promise<ShortenResult> {
  const cacheScope = options?.cacheScope;
  if (cacheScope) {
    const cachedEntry = getCachedShortUrl(cacheScope, url, ttl);
    if (cachedEntry) {
      return {
        ok: true,
        shortUrl: cachedEntry.shortUrl,
        expiresAt: cachedEntry.expiresAt,
        cached: true,
      };
    }
  }

  try {
    let csrfToken = await getCsrfToken();
    let res = await doShortenRequest(url, ttl, csrfToken);

    // 403 may mean a stale CSRF token — invalidate and retry once
    if (res.status === 403) {
      invalidateCsrfToken();
      csrfToken = await fetchCsrfToken();
      res = await doShortenRequest(url, ttl, csrfToken);
    }

    const result = await parseShortenResponse(res, ttl);
    if (result.ok && cacheScope) {
      setCachedShortUrl(cacheScope, url, ttl, result.shortUrl, result.expiresAt);
    }
    return result;
  } catch {
    return {
      ok: false,
      error: { type: 'unavailable', message: 'Could not connect to shortener.' },
    };
  }
}
