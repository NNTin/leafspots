import { useState, useCallback, useRef, useEffect } from 'react';
import type { ShortenResult } from '../lib/leaflet-client';
import { getShortenModalMessage } from './shareMessaging';

const SHARE_TITLE = 'Leafspots 🍃🍺';
const SHARE_TEXT = 'Draw, mark, and share the places you love';

function parseTtlToMs(ttl: string): number | null {
  const match = ttl.match(/^(\d+)([mhdw])$/);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  switch (match[2]) {
    case 'm': return amount * 60_000;
    case 'h': return amount * 3_600_000;
    case 'd': return amount * 86_400_000;
    case 'w': return amount * 604_800_000;
    default: return null;
  }
}

function formatTtlLabel(ttl: string, ttlLabel?: string): string {
  const parsedMs = parseTtlToMs(ttl);
  if (parsedMs === null) {
    return ttlLabel?.trim() || ttl;
  }

  const match = ttl.match(/^(\d+)([mhdw])$/);
  if (!match) return ttlLabel?.trim() || ttl;

  const amount = Number(match[1]);
  const unit =
    match[2] === 'm' ? 'minute'
      : match[2] === 'h' ? 'hour'
        : match[2] === 'd' ? 'day'
          : 'week';

  return `${amount} ${unit}${amount === 1 ? '' : 's'}`;
}

function formatUtcTimestamp(date: Date): string {
  return `${date.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}

function buildShareText(
  selectedTtl?: string,
  selectedTtlLabel?: string,
  expiresAt?: number | null,
): string {
  if (!selectedTtl) return SHARE_TEXT;
  if (selectedTtl === 'never' || expiresAt === null) {
    return `${SHARE_TEXT}. This short link never expires.`;
  }

  if (typeof expiresAt === 'number' && Number.isFinite(expiresAt)) {
    return `${SHARE_TEXT}. This short link expires at ${formatUtcTimestamp(new Date(expiresAt))}.`;
  }

  const ttlMs = parseTtlToMs(selectedTtl);
  if (ttlMs === null) return SHARE_TEXT;

  const nextExpiresAt = new Date(Date.now() + ttlMs);
  const ttlText = formatTtlLabel(selectedTtl, selectedTtlLabel);

  return `${SHARE_TEXT}. This short link expires in ${ttlText} at ${formatUtcTimestamp(nextExpiresAt)}.`;
}

export type ShareModalState =
  | { open: false }
  | { open: true; url: string; shortenError?: string };

interface UseConnectedShareArgs {
  getShareUrl: () => string;
  getShortenedUrl?: (longUrl: string) => Promise<ShortenResult>;
  getShareFile?: () => Promise<File | null>;
  selectedTtl?: string;
  selectedTtlLabel?: string;
}

export function useConnectedShare({
  getShareUrl,
  getShortenedUrl,
  getShareFile,
  selectedTtl,
  selectedTtlLabel,
}: UseConnectedShareArgs) {
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ShareModalState>({ open: false });
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => {
    clearTimeout(copyTimeoutRef.current);
  }, []);

  const openModal = useCallback((url: string, shortenError?: string) => {
    setModal({ open: true, url, shortenError });
    setCopied(false);
    setCopyError(false);
  }, []);

  const handleShare = useCallback(async () => {
    setBusy(true);
    try {
      const longUrl = getShareUrl();

      let shareUrl = longUrl;
      let shareText = SHARE_TEXT;
      let shortenError: string | undefined;

      if (getShortenedUrl) {
        const result = await getShortenedUrl(longUrl);
        if (result.ok) {
          shareUrl = result.shortUrl;
          shareText = buildShareText(selectedTtl, selectedTtlLabel, result.expiresAt);
        } else {
          shortenError = getShortenModalMessage(result.error);
          shareUrl = longUrl;
        }

        if (shortenError) {
          openModal(longUrl, shortenError);
          return;
        }
      }

      if (navigator.share) {
        try {
          let shareFile: File | null = null;

          if (getShareFile) {
            try {
              shareFile = await getShareFile();
            } catch (error) {
              console.error('Failed to capture map share image.', error);
            }
          }

          const shareData: ShareData = {
            title: SHARE_TITLE,
            text: shareText,
            url: shareUrl,
          };

          if (shareFile && navigator.canShare?.({ files: [shareFile] })) {
            shareData.files = [shareFile];
          }

          await navigator.share(shareData);
        } catch (err) {
          if (err instanceof Error && err.name !== 'AbortError') {
            openModal(shareUrl);
          }
        }
      } else {
        openModal(shareUrl);
      }
    } finally {
      setBusy(false);
    }
  }, [getShareFile, getShareUrl, getShortenedUrl, openModal, selectedTtl, selectedTtlLabel]);

  const handleCopy = useCallback(() => {
    if (!modal.open) return;
    navigator.clipboard.writeText(modal.url).then(() => {
      setCopied(true);
      setCopyError(false);
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        copyTimeoutRef.current = undefined;
        setCopied(false);
      }, 2000);
    }).catch(() => {
      setCopyError(true);
    });
  }, [modal]);

  const handleClose = useCallback(() => {
    setModal({ open: false });
    setCopied(false);
    setCopyError(false);
    clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = undefined;
  }, []);

  return {
    busy,
    modal,
    copied,
    copyError,
    handleShare,
    handleCopy,
    handleClose,
  };
}
