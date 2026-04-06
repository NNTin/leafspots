import LZString from 'lz-string';
import type { Stroke } from '../hooks/useDrawing';
import { simplifyStroke } from './strokeSimplify';

export interface MapState {
  center: [number, number];
  zoom: number;
  strokes: Stroke[];
  pin?: [number, number] | null;
  pins?: [number, number, string][];
}

// Prefix used to distinguish LZ-compressed payloads from legacy plain base64.
const LZ_PREFIX = 'z:';

/** Round a coordinate to 5 decimal places (~1 m precision). */
function roundCoord(v: number): number {
  return Math.round(v * 1e5) / 1e5;
}

/**
 * Encode MapState as a URL-safe compressed string.
 * Pipeline: simplify strokes → round coords → JSON → LZ-compress → URI-safe string.
 */
export function encodeMapState(state: MapState): string {
  const compact: MapState = {
    ...state,
    center: [roundCoord(state.center[0]), roundCoord(state.center[1])],
    pin: state.pin
      ? [roundCoord(state.pin[0]), roundCoord(state.pin[1])]
      : state.pin,
    pins: state.pins?.map(([lat, lng, color]) => [roundCoord(lat), roundCoord(lng), color]),
    strokes: state.strokes.map((s) => ({
      ...s,
      points: simplifyStroke(
        s.points.map(([lat, lng]) => [roundCoord(lat), roundCoord(lng)]),
      ),
    })),
  };
  return LZ_PREFIX + LZString.compressToEncodedURIComponent(JSON.stringify(compact));
}

/** Decode a MapState string produced by encodeMapState (or the legacy base64 format). */
export function decodeMapState(encoded: string): MapState | null {
  try {
    let json: string;
    if (encoded.startsWith(LZ_PREFIX)) {
      const decompressed = LZString.decompressFromEncodedURIComponent(
        encoded.slice(LZ_PREFIX.length),
      );
      if (!decompressed) return null;
      json = decompressed;
    } else {
      // Legacy: plain URL-safe base64
      const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      json = atob(base64);
    }
    const parsed = JSON.parse(json) as unknown;
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
