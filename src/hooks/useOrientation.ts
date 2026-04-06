import { useState, useEffect } from 'react';

export type Orientation = 'portrait' | 'landscape';

function getOrientation(): Orientation {
  if (typeof window === 'undefined') return 'landscape';
  if (window.screen?.orientation?.type) {
    return window.screen.orientation.type.startsWith('portrait') ? 'portrait' : 'landscape';
  }
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
}

export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(getOrientation);

  useEffect(() => {
    const update = () => setOrientation(getOrientation());

    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', update);
      return () => window.screen.orientation.removeEventListener('change', update);
    }

    // Fallback for browsers without Screen Orientation API
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return orientation;
}
