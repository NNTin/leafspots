import { useState, useCallback } from 'react';
import type { ShortenResult } from '../lib/leaflet-client';

interface Props {
  getShareUrl: () => string;
  /**
   * When provided the button will shorten the URL before sharing.
   * If shortening fails the modal opens with the original long URL and an
   * error banner; there is no silent fallback.
   */
  getShortenedUrl?: (longUrl: string) => Promise<ShortenResult>;
}

const SHARE_TITLE = 'Leafspots 🍃🍺';
const SHARE_TEXT = 'Draw, mark, and share the places you love';

type ModalState =
  | { open: false }
  | { open: true; url: string; shortenError?: string };

export default function ShareButton({ getShareUrl, getShortenedUrl }: Props) {
  const [shortening, setShortening] = useState(false);
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

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
          shortenError = result.error.message;
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
  }, [getShareUrl, getShortenedUrl, openModal]);

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

  return (
    <>
      <button
        className="share-btn"
        onClick={handleShare}
        disabled={shortening}
        aria-label={shortening ? 'Preparing share link…' : 'Share map'}
      >
        {shortening ? '⏳ Preparing…' : '🔗 Share'}
      </button>

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
                URL shortening failed: {modal.shortenError}. The original link is shown below.
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
    </>
  );
}
