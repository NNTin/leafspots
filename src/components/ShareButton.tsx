import { useState, useCallback } from 'react';

interface Props {
  getShareUrl: () => string;
}

const SHARE_TITLE = 'Leafspots 🍃🍺';
const SHARE_TEXT = 'Draw, mark, and share the places you love';

export default function ShareButton({ getShareUrl }: Props) {
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = getShareUrl();

    if (navigator.share) {
      try {
        await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url });
      } catch (err) {
        // User cancelled or share failed – ignore AbortError
        if (err instanceof Error && err.name !== 'AbortError') {
          setFallbackUrl(url);
          setFallbackOpen(true);
        }
      }
    } else {
      setFallbackUrl(url);
      setFallbackOpen(true);
    }
  }, [getShareUrl]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(fallbackUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      window.history.replaceState(null, '', fallbackUrl);
    });
  }, [fallbackUrl]);

  const handleClose = useCallback(() => {
    setFallbackOpen(false);
    setCopied(false);
  }, []);

  return (
    <>
      <button className="share-btn" onClick={handleShare} aria-label="Share map">
        🔗 Share
      </button>

      {fallbackOpen && (
        <div className="share-modal-overlay" onClick={handleClose}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Share link">
            <h2>Share this map</h2>
            <p>Copy the link below to share your map:</p>
            <div className="share-modal-url-row">
              <input
                className="share-modal-url-input"
                type="text"
                readOnly
                value={fallbackUrl}
                onFocus={(e) => e.target.select()}
                aria-label="Shareable URL"
              />
              <button className="share-modal-copy-btn" onClick={handleCopy}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <button className="share-modal-close-btn" onClick={handleClose} aria-label="Close share dialog">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
