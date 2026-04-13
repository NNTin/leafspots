import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ShortenResult } from '../lib/leaflet-client';
import {
  getShortenModalMessage,
  SHARE_CONNECT_BENEFIT,
  SHARE_CONNECT_BODY,
  SHARE_CONNECT_INSTRUCTIONS,
  SHARE_CONNECT_STEPS,
  SHARE_CONNECT_TITLE,
} from './shareMessaging';

interface Props {
  connected: boolean;
  getShareUrl: () => string;
  /**
   * When provided the button will shorten the URL before sharing.
   * If shortening fails the modal opens with the original long URL and an
   * error banner; there is no silent fallback.
   */
  getShortenedUrl?: (longUrl: string) => Promise<ShortenResult>;
  onOpenSidebar?: () => void;
}

const SHARE_TITLE = 'Leafspots 🍃🍺';
const SHARE_TEXT = 'Draw, mark, and share the places you love';

type ModalState =
  | { open: false }
  | { open: true; url: string; shortenError?: string };

const DISABLED_TOOLTIP_ID = 'share-disabled-tooltip';
const DISABLED_SHEET_TITLE_ID = 'share-disabled-sheet-title';

export default function ShareButton({
  connected,
  getShareUrl,
  getShortenedUrl,
  onOpenSidebar,
}: Props) {
  const [shortening, setShortening] = useState(false);
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [sheetOpen, setSheetOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const infoBtnRef = useRef<HTMLButtonElement>(null);

  const urlInputRef = useCallback((el: HTMLInputElement | null) => {
    if (el) el.select();
  }, []);

  const openModal = useCallback(
    (url: string, shortenError?: string) => {
      setModal({ open: true, url, shortenError });
      setCopied(false);
      setCopyError(false);
    },
    [],
  );

  const handleShare = useCallback(async () => {
    if (!connected) return;

    const longUrl = getShareUrl();

    let shareUrl = longUrl;
    let shortenError: string | undefined;

    if (getShortenedUrl) {
      setShortening(true);
      try {
        const result = await getShortenedUrl(longUrl);
        if (result.ok) {
          shareUrl = result.shortUrl;
        } else {
          // Shortening failed — we will NOT silently fall back to the long URL
          // for Web Share. Show the modal with the error so the user can decide.
          shortenError = getShortenModalMessage(result.error);
          shareUrl = longUrl;
        }
      } finally {
        setShortening(false);
      }

      if (shortenError) {
        // Do not invoke navigator.share with a silently-substituted long URL.
        openModal(longUrl, shortenError);
        return;
      }
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: shareUrl });
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          openModal(shareUrl);
        }
      }
    } else {
      openModal(shareUrl);
    }
  }, [connected, getShareUrl, getShortenedUrl, openModal]);

  const handleCopy = useCallback(() => {
    if (!modal.open) return;
    navigator.clipboard.writeText(modal.url).then(() => {
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      setCopyError(true);
    });
  }, [modal]);

  const handleClose = useCallback(() => {
    setModal({ open: false });
    setCopied(false);
    setCopyError(false);
  }, []);

  const updateTooltipPos = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const maxLeft = Math.max(12, window.innerWidth - 260);
    setTooltipPos({
      top: rect.bottom + 8,
      left: Math.min(Math.max(12, rect.left), maxLeft),
    });
  }, []);

  const showTooltip = useCallback(() => {
    if (connected) return;
    updateTooltipPos();
    setTooltipVisible(true);
  }, [connected, updateTooltipPos]);

  const hideTooltip = useCallback(() => {
    setTooltipVisible(false);
  }, []);

  const handleWrapperBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (!wrapperRef.current?.contains(e.relatedTarget as Node)) {
      hideTooltip();
    }
  }, [hideTooltip]);

  const handleCloseSheet = useCallback(() => {
    setSheetOpen(false);
    infoBtnRef.current?.focus();
  }, []);

  const handleOpenSidebar = useCallback(() => {
    setSheetOpen(false);
    onOpenSidebar?.();
  }, [onOpenSidebar]);

  useEffect(() => {
    if (!sheetOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseSheet();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleCloseSheet, sheetOpen]);

  return (
    <>
      <div className="share-btn-row">
        <div
          ref={wrapperRef}
          className="share-btn-wrapper"
          onMouseEnter={!connected ? showTooltip : undefined}
          onMouseLeave={!connected ? hideTooltip : undefined}
          onFocus={!connected ? showTooltip : undefined}
          onBlur={!connected ? handleWrapperBlur : undefined}
          tabIndex={connected ? -1 : 0}
          aria-describedby={!connected && tooltipVisible ? DISABLED_TOOLTIP_ID : undefined}
        >
          <button
            className={`share-btn${!connected ? ' share-btn-disabled' : ''}`}
            onClick={handleShare}
            disabled={!connected || shortening}
            aria-label={shortening ? 'Preparing share link…' : 'Share map'}
          >
            {shortening ? '⏳ Preparing…' : '🔗 Share'}
          </button>
        </div>

        {!connected && (
          <button
            ref={infoBtnRef}
            className="share-help-info-btn"
            onClick={() => setSheetOpen(true)}
            aria-label={`${SHARE_CONNECT_TITLE}. Tap for more info`}
            aria-haspopup="dialog"
          >
            ⓘ
          </button>
        )}
      </div>

      {!connected && tooltipVisible && createPortal(
        <div
          id={DISABLED_TOOLTIP_ID}
          className="share-help-tooltip"
          role="tooltip"
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
        >
          <strong className="share-help-tooltip-title">{SHARE_CONNECT_TITLE}</strong>
          <p className="share-help-tooltip-body">{SHARE_CONNECT_BODY}</p>
          <p className="share-help-tooltip-note">{SHARE_CONNECT_INSTRUCTIONS}</p>
        </div>,
        document.body,
      )}

      {modal.open && (
        <div className="share-modal-overlay" onClick={handleClose}>
          <div
            className="share-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Share link"
          >
            <h2>Share this map</h2>

            {modal.shortenError && (
              <p className="share-modal-shorten-error">
                {modal.shortenError}
              </p>
            )}

            <p>{modal.shortenError ? 'Copy the original link to share:' : 'Copy the link below to share your map:'}</p>

            <div className="share-modal-url-row">
              <input
                ref={urlInputRef}
                className="share-modal-url-input"
                type="text"
                readOnly
                value={modal.url}
                onFocus={(e) => e.target.select()}
                aria-label="Shareable URL"
              />
              <button className="share-modal-copy-btn" onClick={handleCopy}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>

            {copyError && (
              <p className="share-modal-copy-error">
                Could not copy automatically — please select the URL above and copy it manually.
              </p>
            )}

            <button
              className="share-modal-close-btn"
              onClick={handleClose}
              aria-label="Close share dialog"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {!connected && sheetOpen && createPortal(
        <div
          className="share-help-overlay"
          role="presentation"
          onClick={handleCloseSheet}
        >
          <div
            className="share-help-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={DISABLED_SHEET_TITLE_ID}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="share-help-sheet-header">
              <h2 id={DISABLED_SHEET_TITLE_ID}>{SHARE_CONNECT_TITLE}</h2>
              <button
                className="share-help-close-btn"
                onClick={handleCloseSheet}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <p className="share-help-sheet-body">{SHARE_CONNECT_BODY}</p>
            <p className="share-help-sheet-benefit">{SHARE_CONNECT_BENEFIT}</p>
            <p className="share-help-sheet-note">{SHARE_CONNECT_INSTRUCTIONS}</p>

            <ol className="share-help-sheet-steps">
              {SHARE_CONNECT_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>

            <div className="share-help-sheet-actions">
              {onOpenSidebar && (
                <button className="share-help-primary-btn" onClick={handleOpenSidebar}>
                  Open sidebar
                </button>
              )}
              <button className="share-help-ghost-btn" onClick={handleCloseSheet}>
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
