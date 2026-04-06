import type { Stroke } from '../hooks/useDrawing';

export interface MapState {
  center: [number, number];
  zoom: number;
  strokes: Stroke[];
  pin?: [number, number] | null;
}

/** Encode MapState as a URL-safe base64 string. Coordinates are rounded to 5 decimal places (~1 m precision). */
export function encodeMapState(state: MapState): string {
  const compact: MapState = {
    ...state,
    strokes: state.strokes.map((s) => ({
      ...s,
      points: s.points.map(([lat, lng]) => [
        Math.round(lat * 1e5) / 1e5,
        Math.round(lng * 1e5) / 1e5,
      ] as [number, number]),
    })),
  };
  return btoa(JSON.stringify(compact))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Decode a URL-safe base64 string back to MapState. Returns null on failure. */
export function decodeMapState(encoded: string): MapState | null {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(atob(base64)) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'center' in parsed &&
      'zoom' in parsed &&
      'strokes' in parsed
    ) {
      return parsed as MapState;
    }
    return null;
  } catch {
    return null;
  }
}

/** Read MapState from the current URL's `?state=` parameter. */
export function loadStateFromUrl(): MapState | null {
  const encoded = new URLSearchParams(window.location.search).get('state');
  if (!encoded) return null;
  return decodeMapState(encoded);
}

/** Build a full shareable URL for the given MapState. */
export function buildShareUrl(state: MapState): string {
  const url = new URL(window.location.href);
  url.searchParams.set('state', encodeMapState(state));
  return url.toString();
}
