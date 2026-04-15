import { useState, useEffect } from 'react';

// BeforeInstallPromptEvent is not yet in the standard TypeScript DOM lib
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Whether and how the PWA can be installed on this device. */
export type InstallState =
  | 'hidden'    // already installed, or not eligible
  | 'android'   // native install prompt available (Chrome/Edge on Android/desktop)
  | 'ios';      // iOS Safari: must use the Share → Add to Home Screen flow

export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState<InstallState>('hidden');

  useEffect(() => {
    // Don't show banner if already running as an installed PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) return;

    // iOS Safari: no beforeinstallprompt event — show manual instructions
    const isIOS =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;

    if (isIOS) {
      setInstallState('ios');
      return;
    }

    // Android / Chrome / Edge: capture the deferred prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      setInstallState('android');
    };

    const handleAppInstalled = () => setInstallState('hidden');

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') setInstallState('hidden');
    setPromptEvent(null);
  };

  const dismiss = () => setInstallState('hidden');

  return { installState, install, dismiss };
}
