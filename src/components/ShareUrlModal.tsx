import { useCallback } from 'react';
import type { ShareModalState } from './shareLogic';

interface Props {
  modal: ShareModalState;
  copied: boolean;
  copyError: boolean;
  onCopy: () => void;
  onClose: () => void;
}

export default function ShareUrlModal({
  modal,
  copied,
  copyError,
  onCopy,
  onClose,
}: Props) {
  const urlInputRef = useCallback((el: HTMLInputElement | null) => {
    if (el) el.select();
  }, []);

  if (!modal.open) return null;

  return (
    <div className="share-modal-overlay" onClick={onClose}>
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
          <button className="share-modal-copy-btn" onClick={onCopy}>
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
          onClick={onClose}
          aria-label="Close share dialog"
        >
          Close
        </button>
      </div>
    </div>
  );
}
