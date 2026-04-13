import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiInfo } from 'react-icons/fi';
import type { ShortenResult } from '../lib/leaflet-client';
import {
  SHARE_CONNECT_BENEFIT,
  SHARE_CONNECT_BODY,
  SHARE_CONNECT_INSTRUCTIONS,
  SHARE_CONNECT_STEPS,
  SHARE_CONNECT_TITLE,
} from './shareMessaging';
import ShareUrlModal from './ShareUrlModal';
import { useConnectedShare } from './shareLogic';

interface Props {
  connected: boolean;
  getShareUrl: () => string;
  selectedTtl?: string;
  selectedTtlLabel?: string;
  /**
   * When provided the button will shorten the URL before sharing.
   * If shortening fails the modal opens with the original long URL and an
   * error banner; there is no silent fallback.
   */
  getShortenedUrl?: (longUrl: string) => Promise<ShortenResult>;
  onOpenSidebar?: () => void;
}

const DISABLED_TOOLTIP_ID = 'share-disabled-tooltip';
const DISABLED_SHEET_TITLE_ID = 'share-disabled-sheet-title';

export default function ShareButton({
  connected,
  getShareUrl,
  selectedTtl,
  selectedTtlLabel,
  getShortenedUrl,
  onOpenSidebar,
}: Props) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [sheetOpen, setSheetOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const infoBtnRef = useRef<HTMLButtonElement>(null);

  const share = useConnectedShare({
    getShareUrl,
    getShortenedUrl,
    selectedTtl,
    selectedTtlLabel,
  });

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
            onClick={share.handleShare}
            disabled={!connected || share.busy}
            aria-label={share.busy ? 'Preparing share link…' : 'Share map'}
          >
            {share.busy ? '⏳ Preparing…' : '🔗 Share'}
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
            <FiInfo aria-hidden="true" focusable="false" />
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

      <ShareUrlModal
        modal={share.modal}
        copied={share.copied}
        copyError={share.copyError}
        onCopy={share.handleCopy}
        onClose={share.handleClose}
      />

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
