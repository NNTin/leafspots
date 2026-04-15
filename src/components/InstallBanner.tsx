import type { InstallState } from '../hooks/useInstallPrompt';

interface InstallBannerProps {
  state: InstallState;
  onInstall: () => void;
  onDismiss: () => void;
}

export default function InstallBanner({ state, onInstall, onDismiss }: InstallBannerProps) {
  if (state === 'hidden') return null;

  return (
    <div className="install-banner" role="complementary" aria-label="Install Leafspots">
      {/* TODO: Replace with a proper promotional graphic (e.g. a branded banner image).
               Current placeholder just uses the app icon. Recommended size: 48×48 display px. */}
      <img
        className="install-banner-icon"
        src="/icon-192.png"
        alt="Leafspots icon"
        width={40}
        height={40}
      />

      <div className="install-banner-text">
        <span className="install-banner-title">Install Leafspots</span>
        {state === 'ios' ? (
          <span className="install-banner-sub">
            Tap <strong>Share</strong> then <strong>Add to Home Screen</strong>
          </span>
        ) : (
          <span className="install-banner-sub">Works offline · feels native</span>
        )}
      </div>

      {state === 'android' && (
        <button className="install-banner-btn" onClick={onInstall}>
          Install
        </button>
      )}

      <button
        className="install-banner-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss install banner"
      >
        ✕
      </button>
    </div>
  );
}
