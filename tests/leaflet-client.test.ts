import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  });
}

function resolveRequestUrl(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function createShortenerFetchMock() {
  let csrfCalls = 0;
  let shortenCalls = 0;

  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const requestUrl = resolveRequestUrl(input);

    if (requestUrl.endsWith('/auth/csrf-token')) {
      csrfCalls += 1;
      return jsonResponse({ csrfToken: 'test-csrf-token' });
    }

    if (requestUrl.endsWith('/api/shorten')) {
      shortenCalls += 1;
      return jsonResponse({ shortUrl: `https://sho.rt/${shortenCalls}` });
    }

    throw new Error(`Unexpected fetch request: ${requestUrl}`);
  });

  return {
    fetchMock,
    get csrfCalls() {
      return csrfCalls;
    },
    get shortenCalls() {
      return shortenCalls;
    },
  };
}

async function loadClient() {
  return import('../src/lib/leaflet-client');
}

describe('shortenUrl cache reuse', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T00:00:00.000Z'));
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('reuses the cached short URL when the long URL and TTL are unchanged', async () => {
    const shortener = createShortenerFetchMock();
    vi.stubGlobal('fetch', shortener.fetchMock);

    const client = await loadClient();
    const first = await client.shortenUrl('https://example.com/#state=same', '5m', {
      cacheScope: 'anonymous',
    });
    const second = await client.shortenUrl('https://example.com/#state=same', '5m', {
      cacheScope: 'anonymous',
    });

    expect(first).toMatchObject({
      ok: true,
      shortUrl: 'https://sho.rt/1',
      cached: false,
      expiresAt: Date.parse('2026-04-18T00:05:00.000Z'),
    });
    expect(second).toEqual({
      ok: true,
      shortUrl: 'https://sho.rt/1',
      cached: true,
      expiresAt: Date.parse('2026-04-18T00:05:00.000Z'),
    });
    expect(shortener.csrfCalls).toBe(1);
    expect(shortener.shortenCalls).toBe(1);
  });

  it('requests a fresh short URL when the long URL changes', async () => {
    const shortener = createShortenerFetchMock();
    vi.stubGlobal('fetch', shortener.fetchMock);

    const client = await loadClient();
    const first = await client.shortenUrl('https://example.com/#state=one', '5m', {
      cacheScope: 'anonymous',
    });
    const second = await client.shortenUrl('https://example.com/#state=two', '5m', {
      cacheScope: 'anonymous',
    });

    expect(first).toMatchObject({ ok: true, shortUrl: 'https://sho.rt/1', cached: false });
    expect(second).toMatchObject({ ok: true, shortUrl: 'https://sho.rt/2', cached: false });
    expect(shortener.shortenCalls).toBe(2);
  });

  it('requests a fresh short URL when the TTL changes', async () => {
    const shortener = createShortenerFetchMock();
    vi.stubGlobal('fetch', shortener.fetchMock);

    const client = await loadClient();
    const first = await client.shortenUrl('https://example.com/#state=same', '5m', {
      cacheScope: 'anonymous',
    });
    const second = await client.shortenUrl('https://example.com/#state=same', '1h', {
      cacheScope: 'anonymous',
    });

    expect(first).toMatchObject({
      ok: true,
      shortUrl: 'https://sho.rt/1',
      cached: false,
      expiresAt: Date.parse('2026-04-18T00:05:00.000Z'),
    });
    expect(second).toMatchObject({
      ok: true,
      shortUrl: 'https://sho.rt/2',
      cached: false,
      expiresAt: Date.parse('2026-04-18T01:00:00.000Z'),
    });
    expect(shortener.shortenCalls).toBe(2);
  });

  it('requests a fresh short URL after the cached entry has expired', async () => {
    const shortener = createShortenerFetchMock();
    vi.stubGlobal('fetch', shortener.fetchMock);

    const client = await loadClient();
    const first = await client.shortenUrl('https://example.com/#state=same', '5m', {
      cacheScope: 'anonymous',
    });

    vi.setSystemTime(new Date('2026-04-18T00:05:00.001Z'));

    const second = await client.shortenUrl('https://example.com/#state=same', '5m', {
      cacheScope: 'anonymous',
    });

    expect(first).toMatchObject({ ok: true, shortUrl: 'https://sho.rt/1', cached: false });
    expect(second).toMatchObject({
      ok: true,
      shortUrl: 'https://sho.rt/2',
      cached: false,
      expiresAt: Date.parse('2026-04-18T00:10:00.001Z'),
    });
    expect(shortener.shortenCalls).toBe(2);
  });

  it('reuses the cached short URL after a module reload', async () => {
    const firstShortener = createShortenerFetchMock();
    vi.stubGlobal('fetch', firstShortener.fetchMock);

    const firstClient = await loadClient();
    const first = await firstClient.shortenUrl('https://example.com/#state=same', '5m', {
      cacheScope: 'anonymous',
    });

    vi.resetModules();

    const secondShortener = createShortenerFetchMock();
    vi.stubGlobal('fetch', secondShortener.fetchMock);

    const secondClient = await loadClient();
    const second = await secondClient.shortenUrl('https://example.com/#state=same', '5m', {
      cacheScope: 'anonymous',
    });

    expect(first).toMatchObject({ ok: true, shortUrl: 'https://sho.rt/1', cached: false });
    expect(second).toEqual({
      ok: true,
      shortUrl: 'https://sho.rt/1',
      cached: true,
      expiresAt: Date.parse('2026-04-18T00:05:00.000Z'),
    });
    expect(firstShortener.shortenCalls).toBe(1);
    expect(secondShortener.shortenCalls).toBe(0);
    expect(secondShortener.csrfCalls).toBe(0);
  });
});
