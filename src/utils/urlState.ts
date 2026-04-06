import { deflateSync, inflateSync } from 'fflate';
import type { Stroke } from '../hooks/useDrawing';
import { simplifyStroke } from './strokeSimplify';

export interface MapState {
  center: [number, number];
  zoom: number;
  strokes: Stroke[];
  pin?: [number, number] | null;
  pins?: [number, number, string][];
}

// ─── Palette (must stay in sync with DrawingControls.tsx) ─────────────────────
const COLORS = ['#e53935', '#1e88e5', '#43a047', '#f4511e', '#000000', '#ffffff'];
const WIDTHS = [2, 4, 6];

// ─── Versioning prefixes ───────────────────────────────────────────────────────
const V2_PREFIX = 'v2:';

// ─── Integer ↔ float helpers (5 decimal places ≈ 1 m precision) ───────────────
function i5(v: number): number { return Math.round(v * 1e5); }
function f5(v: number): number { return v / 1e5; }

// ─── Color / width palette encoding ───────────────────────────────────────────
function encodeColor(hex: string): number | string {
  const idx = COLORS.indexOf(hex);
  return idx >= 0 ? idx : hex.slice(1); // palette index, or 6-char hex without '#'
}
function decodeColor(v: number | string): string {
  return typeof v === 'number' ? COLORS[v] : '#' + v;
}
function encodeWidth(w: number): number {
  const idx = WIDTHS.indexOf(w);
  return idx >= 0 ? idx : w; // palette index, or raw value as fallback
}
function decodeWidth(v: number): number {
  return v < WIDTHS.length ? WIDTHS[v] : v;
}

// ─── Base64url (RFC 4648 §5, no padding) ──────────────────────────────────────
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function fromBase64Url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '==='.slice(0, (4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ─── Compact v2 wire format ────────────────────────────────────────────────────
// [centerLat5, centerLng5, zoom, pin|null, strokes, pins]
// stroke: [colorIdxOrHex, widthIdx, flatDeltaPoints]
//   flatDeltaPoints: [lat5_0, lng5_0, Δlat5_1, Δlng5_1, …]  (all integers)
// pin: [lat5, lng5] | null
// pins entry: [lat5, lng5, colorIdxOrHex]
type CompactColor = number | string;
type CompactStroke = [CompactColor, number, number[]];
type CompactPin = [number, number, CompactColor];
type CompactV2 = [number, number, number, [number, number] | null, CompactStroke[], CompactPin[]];

function toCompactV2(state: MapState): CompactV2 {
  const strokes: CompactStroke[] = state.strokes.map((s) => {
    const simplified = simplifyStroke(s.points);
    const flat: number[] = [];
    let pLat = 0, pLng = 0;
    for (let i = 0; i < simplified.length; i++) {
      const lat5 = i5(simplified[i][0]);
      const lng5 = i5(simplified[i][1]);
      flat.push(lat5 - pLat, lng5 - pLng);
      pLat = lat5;
      pLng = lng5;
    }
    return [encodeColor(s.color), encodeWidth(s.width), flat];
  });

  const pins: CompactPin[] = (state.pins ?? []).map(([lat, lng, color]) => [
    i5(lat), i5(lng), encodeColor(color),
  ]);

  return [
    i5(state.center[0]),
    i5(state.center[1]),
    state.zoom,
    state.pin ? [i5(state.pin[0]), i5(state.pin[1])] : null,
    strokes,
    pins,
  ];
}

function fromCompactV2(c: CompactV2): MapState {
  const [cLat5, cLng5, zoom, pinRaw, strokesRaw, pinsRaw] = c;

  const strokes: Stroke[] = strokesRaw.map((s, idx) => {
    const [colorRaw, widthRaw, flat] = s;
    const points: [number, number][] = [];
    let pLat = 0, pLng = 0;
    for (let i = 0; i < flat.length; i += 2) {
      pLat += flat[i];
      pLng += flat[i + 1];
      points.push([f5(pLat), f5(pLng)]);
    }
    return { id: `s${idx}`, color: decodeColor(colorRaw), width: decodeWidth(widthRaw), points };
  });

  const pins: [number, number, string][] = pinsRaw.map(
    ([lat5, lng5, colorRaw]) => [f5(lat5), f5(lng5), decodeColor(colorRaw)],
  );

  return {
    center: [f5(cLat5), f5(cLng5)],
    zoom,
    pin: pinRaw ? [f5(pinRaw[0]), f5(pinRaw[1])] : null,
    strokes,
    pins,
  };
}

// ─── Public encode / decode ────────────────────────────────────────────────────

/**
 * Encode MapState as a URL-safe string.
 * Pipeline: compact positional format → JSON → DEFLATE → base64url, prefixed with "v2:".
 */
export function encodeMapState(state: MapState): string {
  const json = JSON.stringify(toCompactV2(state));
  const compressed = deflateSync(new TextEncoder().encode(json), { level: 9 });
  return V2_PREFIX + toBase64Url(compressed);
}

/** Decode a MapState string produced by encodeMapState. */
export function decodeMapState(encoded: string): MapState | null {
  try {
    if (!encoded.startsWith(V2_PREFIX)) return null;
    const compressed = fromBase64Url(encoded.slice(V2_PREFIX.length));
    const json = new TextDecoder().decode(inflateSync(compressed));
    return fromCompactV2(JSON.parse(json) as CompactV2);
  } catch {
    return null;
  }
}

/** Read MapState from the URL hash (#state=…). */
export function loadStateFromUrl(): MapState | null {
  const encoded = new URLSearchParams(window.location.hash.slice(1)).get('state');
  if (!encoded) return null;
  return decodeMapState(encoded);
}

/** Build a full shareable URL, placing state in the URL hash. */
export function buildShareUrl(state: MapState): string {
  const url = new URL(window.location.href);
  url.hash = 'state=' + encodeMapState(state);
  return url.toString();
}
