import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ShortenResult } from '../lib/leaflet-client';
import {
  NAV_SHARE_UPSELL_BODY,
  SHARE_CONNECT_BENEFIT,
  SHARE_CONNECT_STEPS,
} from './shareMessaging';

interface Props {
  connected: boolean;
  getShareUrl: () => string;
  /**
   * When provided (connected state) the button shortens the URL before copying.
   * Omitting this prop puts the button in disconnected mode: copy the long URL
   * immediately and show the connect-upsell modal afterwards.
   */
  getShortenedUrl?: (longUrl: string) => Promise<ShortenResult>;
  onCopied?: (message: string) => void;
  onOpenSidebar?: () => void;
}

const UPSELL_TITLE_ID = 'nav-share-upsell-title';

export default function NavShareButton({
  connected,
  getShareUrl,
  getShortenedUrl,
  onCopied,
  onOpenSidebar,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);

  useEffect(() => {
    if (!upsellOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUpsellOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [upsellOpen]);

  const handleClick = useCallback(async () => {
    const longUrl = getShareUrl();
    let toCopy = longUrl;
    const copyMsg = 'Link copied';

    if (connected && getShortenedUrl) {
      setBusy(true);
      try {
        const result = await getShortenedUrl(longUrl);
        if (result.ok) {
          toCopy = result.shortUrl;
        }
        // shortening failed — silently fall back to long URL for nav copy
      } finally {
        setBusy(false);
      }
    }

    try {
      await navigator.clipboard.writeText(toCopy);
      onCopied?.(copyMsg);
    } catch {
      window.history.replaceState(null, '', toCopy);
      onCopied?.('URL updated — copy from address bar');
    }

    if (!connected) {
      setUpsellOpen(true);
    }
  }, [connected, getShareUrl, getShortenedUrl, onCopied]);

  const closeUpsell = useCallback(() => setUpsellOpen(false), []);

  const handleOpenSidebar = useCallback(() => {
    closeUpsell();
    onOpenSidebar?.();
  }, [closeUpsell, onOpenSidebar]);

  return (
    <>
      <button
        className="draw-action-btn"
        onClick={handleClick}
        disabled={busy}
        title={busy ? 'Preparing link…' : 'Copy shareable link to clipboard'}
        aria-label={busy ? 'Preparing link…' : 'Copy shareable link'}
      >
        {busy ? '⏳' : '🔗'}
      </button>

      {upsellOpen && createPortal(
        <div
          className="share-upsell-overlay"
          role="presentation"
          onClick={closeUpsell}
        >
          <div
            className="share-upsell-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={UPSELL_TITLE_ID}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={UPSELL_TITLE_ID}>Link copied</h2>
            <p className="share-upsell-body">
              {NAV_SHARE_UPSELL_BODY}
            </p>
            <p className="share-upsell-benefit">{SHARE_CONNECT_BENEFIT}</p>
            <ol className="share-upsell-steps">
              {SHARE_CONNECT_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="share-upsell-actions">
              {onOpenSidebar && (
                <button
                  className="share-upsell-btn-primary"
                  onClick={handleOpenSidebar}
                  autoFocus
                >
                  Open sidebar
                </button>
              )}
              <button className="share-upsell-btn-ghost" onClick={closeUpsell}>
                Dismiss
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
