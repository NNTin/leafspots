import { useState, useCallback } from 'react';
import type { Coordinates } from '../utils/distance';

type GpsState = 'idle' | 'loading' | 'success' | 'error';

interface GpsButtonProps {
  onLocationDetected: (loc: Coordinates) => void;
}

export default function GpsButton({ onLocationDetected }: GpsButtonProps) {
  const [state, setState] = useState<GpsState>('idle');

  const handleClick = useCallback(() => {
    if (state === 'loading') return;

    if (!navigator.geolocation) {
      setState('error');
      setTimeout(() => setState('idle'), 2000);
      return;
    }

    setState('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLocationDetected({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setState('success');
        setTimeout(() => setState('idle'), 1500);
      },
      () => {
        setState('error');
        setTimeout(() => setState('idle'), 2000);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [state, onLocationDetected]);

  const label =
    state === 'loading' ? 'Locating…' :
    state === 'success' ? 'Location set' :
    state === 'error'   ? 'Location unavailable' :
    'Find my location';

  return (
    <button
      className={`gps-btn gps-btn--${state}`}
      onClick={handleClick}
      aria-label={label}
      title={label}
    >
      {state === 'loading' && <span className="gps-spinner" aria-hidden="true" />}
      {state === 'success' && <GpsIconSuccess />}
      {state === 'error'   && <GpsIconError />}
      {state === 'idle'    && <GpsIconIdle />}
    </button>
  );
}

function GpsIconIdle() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

function GpsIconSuccess() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function GpsIconError() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
