import { toBlob } from 'html-to-image';

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

export async function captureMapViewImage(element: HTMLElement): Promise<File | null> {
  await nextPaint();

  const blob = await toBlob(element, {
    backgroundColor: '#ffffff',
    cacheBust: navigator.onLine,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  });

  if (!blob) return null;

  return new File([blob], 'leafspots-map.png', {
    type: blob.type || 'image/png',
    lastModified: Date.now(),
  });
}
