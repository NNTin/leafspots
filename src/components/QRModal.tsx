import { useRef, useState } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';

interface Props {
  url: string;
  onClose: () => void;
}

const QR_SIZE = 240;
const LOGO_TEXT = '🍃🍺';
const LOGO_BADGE_RADIUS = 20;
const LOGO_FONT_SIZE = 22;

export default function QRModal({ url, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    const src = canvasRef.current;
    if (!src) return;

    const padding = 16;
    const out = document.createElement('canvas');
    out.width = QR_SIZE + padding * 2;
    out.height = QR_SIZE + padding * 2;
    const ctx = out.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);

    ctx.drawImage(src, padding, padding, QR_SIZE, QR_SIZE);

    // Emoji badge centred over the QR code
    const cx = out.width / 2;
    const cy = out.height / 2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, LOGO_BADGE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${LOGO_FONT_SIZE}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(LOGO_TEXT, cx, cy);

    const link = document.createElement('a');
    link.download = 'leafspots-qr.png';
    link.href = out.toDataURL('image/png');
    link.click();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      window.prompt('Copy this link:', url);
    });
  };

  const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className="qr-overlay"
      onClick={onClose}
      onKeyDown={handleOverlayKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Share QR code"
      tabIndex={-1}
    >
      <div className="qr-modal" onClick={(e) => e.stopPropagation()} role="document">
        <button className="qr-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <h2 className="qr-title">Share</h2>

        {/* Visible QR with emoji logo overlay */}
        <div className="qr-code-wrap">
          <QRCodeSVG value={url} size={QR_SIZE} level="H" marginSize={2} />
          <div className="qr-logo" aria-hidden="true">
            {LOGO_TEXT}
          </div>
        </div>

        {/* Hidden canvas used only for PNG download */}
        <QRCodeCanvas
          value={url}
          size={QR_SIZE}
          level="H"
          marginSize={2}
          ref={canvasRef}
          style={{ display: 'none' }}
        />

        <p className="qr-url">{url}</p>

        <div className="qr-actions">
          <button className="qr-btn qr-btn-primary" onClick={handleDownload}>
            ⬇ Download QR
          </button>
          <button className="qr-btn" onClick={handleCopy}>
            {copied ? '✓ Copied!' : '🔗 Copy link'}
          </button>
        </div>
      </div>
    </div>
  );
}
