import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  NAV_SHARE_UPSELL_BODY,
  SHARE_CONNECT_BENEFIT,
  SHARE_CONNECT_STEPS,
} from './shareMessaging';
import ShareUrlModal from './ShareUrlModal';
import { useConnectedShare } from './shareLogic';
import type { ShortenResult } from '../lib/leaflet-client';

type CopyFeedbackTone = 'success' | 'error';

interface Props {
  connected: boolean;
  getShareUrl: () => string;
  selectedTtl?: string;
  selectedTtlLabel?: string;
  /**
   * When provided (connected state) the button shortens the URL before copying.
   * Omitting this prop puts the button in disconnected mode: copy the long URL
   * immediately and show the connect-upsell modal afterwards.
   */
  getShortenedUrl?: (longUrl: string) => Promise<ShortenResult>;
  onCopied?: (message: string, tone?: CopyFeedbackTone) => void;
  onOpenSidebar?: () => void;
}

const UPSELL_TITLE_ID = 'nav-share-upsell-title';

export default function NavShareButton({
  connected,
  getShareUrl,
  selectedTtl,
  selectedTtlLabel,
  getShortenedUrl,
  onCopied,
  onOpenSidebar,
}: Props) {
  const [upsellOpen, setUpsellOpen] = useState(false);
  const share = useConnectedShare({
    getShareUrl,
    getShortenedUrl,
    selectedTtl,
    selectedTtlLabel,
  });

  useEffect(() => {
    if (!upsellOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUpsellOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [upsellOpen]);

  const handleClick = useCallback(async () => {
    if (connected) {
      await share.handleShare();
      return;
    }

    const longUrl = getShareUrl();

    try {
      await navigator.clipboard.writeText(longUrl);
      onCopied?.('Link copied', 'success');
    } catch {
      window.history.replaceState(null, '', longUrl);
      onCopied?.('URL updated — copy from address bar', 'success');
    }

    setUpsellOpen(true);
  }, [connected, getShareUrl, onCopied, share]);

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
        disabled={share.busy}
        title={share.busy ? 'Preparing share link…' : connected ? 'Share shortened link' : 'Copy shareable link to clipboard'}
        aria-label={share.busy ? 'Preparing share link…' : connected ? 'Share shortened link' : 'Copy shareable link'}
      >
        {share.busy ? '⏳' : '🔗'}
      </button>

      <ShareUrlModal
        modal={share.modal}
        copied={share.copied}
        copyError={share.copyError}
        onCopy={share.handleCopy}
        onClose={share.handleClose}
      />

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
