import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiInfo } from 'react-icons/fi';
import type { ConnectionState, LeafletConnectionState } from '../hooks/useLeafletConnection';
import type { LeafletCapabilities } from '../lib/leaflet-client';

interface Props extends LeafletConnectionState {
  selectedTtl: string;
  onTtlChange: (ttl: string) => void;
}

const LEAFLET_SOURCE_URL = 'https://github.com/NNTin/leaflet';

function statusLabel(
  state: ConnectionState,
  username: string | null,
  retryAfter: number | null,
): string {
  switch (state) {
    case 'disconnected': return 'Disconnected';
    case 'connecting':   return 'Connecting…';
    case 'anonymous':    return 'Connected anonymously';
    case 'authenticated': return `Connected as ${username ?? ''}`;
    case 'rate-limited':
      return retryAfter != null
        ? `Rate-limited — retry in ${retryAfter}s`
        : 'Rate-limited';
    case 'unavailable':  return 'Unavailable';
  }
}

function statusClass(state: ConnectionState): string {
  switch (state) {
    case 'anonymous':
    case 'authenticated': return 'leaflet-status-badge leaflet-status-ok';
    case 'connecting':    return 'leaflet-status-badge leaflet-status-busy';
    case 'rate-limited':  return 'leaflet-status-badge leaflet-status-warn';
    case 'unavailable':   return 'leaflet-status-badge leaflet-status-error';
    default:              return 'leaflet-status-badge';
  }
}

const STATUS_TOOLTIP_ID = 'leaflet-status-tooltip';
const INFO_SHEET_TITLE_ID = 'leaflet-info-sheet-title';

function getStatusInfo(
  state: ConnectionState,
  username: string | null,
): { title: string; description: string; ttlNote: string } | null {
  if (state === 'anonymous') {
    return {
      title: 'Connected anonymously',
      description: 'You are connected without an account. Your data is not linked to any profile.',
      ttlNote: 'Short links can expire after: 5m, 1h, or 1d.',
    };
  }
  if (state === 'authenticated') {
    return {
      title: `Connected as ${username ?? ''}`,
      description: 'You are signed in and your data is associated with your account.',
      ttlNote: 'Short links can expire after: 5m, 1h, 1d, or 1w.',
    };
  }
  return null;
}

function ConnectionStatusInfo({
  connectionState,
  username,
  retryAfter,
}: {
  connectionState: ConnectionState;
  username: string | null;
  retryAfter: number | null;
}) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [sheetOpen, setSheetOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const infoBtnRef = useRef<HTMLButtonElement>(null);

  const info = getStatusInfo(connectionState, username);

  const updateTooltipPos = () => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setTooltipPos({ top: rect.bottom + 8, left: rect.left });
  };

  const showTooltip = () => { updateTooltipPos(); setTooltipVisible(true); };
  const hideTooltip = () => setTooltipVisible(false);

  const handleBlur = (e: React.FocusEvent) => {
    if (!wrapperRef.current?.contains(e.relatedTarget as Node)) {
      hideTooltip();
    }
  };

  useEffect(() => {
    if (!sheetOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSheetOpen(false);
        infoBtnRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [sheetOpen]);

  const label = statusLabel(connectionState, username, retryAfter);
  const badgeClass = statusClass(connectionState);

  if (!info) {
    return <span className={badgeClass}>{label}</span>;
  }

  return (
    <>
      <div
        ref={wrapperRef}
        className="leaflet-status-info-wrapper"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={handleBlur}
      >
        <span
          className={`${badgeClass} leaflet-status-hoverable`}
          tabIndex={0}
          aria-describedby={STATUS_TOOLTIP_ID}
        >
          {label}
        </span>
        <button
          ref={infoBtnRef}
          className="leaflet-status-info-btn"
          onClick={() => setSheetOpen(true)}
          aria-label={`${label} — tap for more info`}
          aria-haspopup="dialog"
        >
          <FiInfo aria-hidden="true" focusable="false" />
        </button>
      </div>

      {tooltipVisible && createPortal(
        <div
          id={STATUS_TOOLTIP_ID}
          className="leaflet-status-tooltip"
          role="tooltip"
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
        >
          <strong className="leaflet-status-tooltip-title">{info.title}</strong>
          <p className="leaflet-status-tooltip-body">{info.description}</p>
          <p className="leaflet-status-tooltip-ttl">{info.ttlNote}</p>
        </div>,
        document.body,
      )}

      {sheetOpen && createPortal(
        <div
          className="leaflet-info-overlay"
          role="presentation"
          onClick={() => { setSheetOpen(false); infoBtnRef.current?.focus(); }}
        >
          <div
            className="leaflet-info-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={INFO_SHEET_TITLE_ID}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="leaflet-info-sheet-header">
              <span className={`${badgeClass} leaflet-info-sheet-badge`}>{label}</span>
              <button
                className="leaflet-info-sheet-close"
                onClick={() => { setSheetOpen(false); infoBtnRef.current?.focus(); }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p id={INFO_SHEET_TITLE_ID} className="leaflet-info-sheet-desc">
              {info.description}
            </p>
            <p className="leaflet-info-sheet-ttl">{info.ttlNote}</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function TtlSelector({
  capabilities,
  selectedTtl,
  onTtlChange,
}: {
  capabilities: LeafletCapabilities;
  selectedTtl: string;
  onTtlChange: (ttl: string) => void;
}) {
  if (!capabilities.shortenAllowed || capabilities.ttlOptions.length === 0) return null;

  const effectiveTtl = capabilities.ttlOptions.some((o) => o.value === selectedTtl)
    ? selectedTtl
    : capabilities.ttlOptions[0].value;

  return (
    <div className="leaflet-ttl-row">
      <label htmlFor="leaflet-ttl" className="leaflet-ttl-label">
        Link expires
      </label>
      <select
        id="leaflet-ttl"
        className="leaflet-ttl-select"
        value={effectiveTtl}
        onChange={(e) => onTtlChange(e.target.value)}
      >
        {capabilities.ttlOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function LeafletPanel({
  connectionState,
  username,
  retryAfter,
  capabilities,
  authReturnFailed,
  selectedTtl,
  onTtlChange,
  connect,
  disconnect,
  logout,
  refresh,
  clearAuthReturn,
}: Props) {
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);

  const handleLogout = async () => {
    setLogoutBusy(true);
    try { await logout(); } finally { setLogoutBusy(false); }
  };

  const handleRefresh = async () => {
    setRefreshBusy(true);
    try { await refresh(); } finally { setRefreshBusy(false); }
  };

  const isConnected =
    connectionState === 'anonymous' || connectionState === 'authenticated';

  return (
    <div className="leaflet-panel">
      <h2>URL Shortener</h2>

      {/* Auth-return failure banner */}
      {authReturnFailed && (
        <div className="leaflet-auth-banner" role="alert">
          <span>Sign-in failed. You can try again or connect anonymously.</span>
          <button
            className="leaflet-auth-banner-close"
            onClick={clearAuthReturn}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Status row (only when not disconnected) */}
      {connectionState !== 'disconnected' && (
        <div className="leaflet-status-row">
          <ConnectionStatusInfo
            connectionState={connectionState}
            username={username}
            retryAfter={retryAfter}
          />
        </div>
      )}

      {/* Disconnected: connect options */}
      {connectionState === 'disconnected' && (
        <div className="leaflet-actions">
          <button
            className="leaflet-btn leaflet-btn-primary"
            onClick={() => connect('anonymous')}
          >
            Connect anonymously
          </button>
          <button
            className="leaflet-btn leaflet-btn-secondary"
            onClick={() => connect('authenticated')}
          >
            Sign in to Leaflet
          </button>
        </div>
      )}

      {/* Anonymous: TTL selector + upgrade + disconnect */}
      {connectionState === 'anonymous' && (
        <>
          {capabilities && (
            <TtlSelector
              capabilities={capabilities}
              selectedTtl={selectedTtl}
              onTtlChange={onTtlChange}
            />
          )}
          <p className="leaflet-hint">
            Authenticated Leaflet accounts have higher shortening limits.
          </p>
          <div className="leaflet-actions">
            <button
              className="leaflet-btn leaflet-btn-secondary"
              onClick={() => connect('authenticated')}
            >
              Sign in to Leaflet
            </button>
            <button className="leaflet-btn leaflet-btn-ghost" onClick={disconnect}>
              Disconnect
            </button>
          </div>
        </>
      )}

      {/* Authenticated: TTL selector + logout + disconnect */}
      {connectionState === 'authenticated' && (
        <>
          {capabilities && (
            <TtlSelector
              capabilities={capabilities}
              selectedTtl={selectedTtl}
              onTtlChange={onTtlChange}
            />
          )}
          <div className="leaflet-actions">
            <button
              className="leaflet-btn leaflet-btn-ghost"
              onClick={handleLogout}
              disabled={logoutBusy}
            >
              {logoutBusy ? 'Logging out…' : 'Log out of Leaflet'}
            </button>
            <button className="leaflet-btn leaflet-btn-ghost" onClick={disconnect}>
              Disconnect
            </button>
          </div>
        </>
      )}

      {/* Rate-limited or unavailable: retry + disconnect */}
      {(connectionState === 'rate-limited' || connectionState === 'unavailable') && (
        <div className="leaflet-actions">
          <button
            className="leaflet-btn leaflet-btn-secondary"
            onClick={handleRefresh}
            disabled={refreshBusy}
          >
            {refreshBusy ? 'Retrying…' : 'Retry'}
          </button>
          <button className="leaflet-btn leaflet-btn-ghost" onClick={disconnect}>
            Disconnect
          </button>
        </div>
      )}

      {/* Disclaimer (always shown when not disconnected OR when disconnected to explain what it is) */}
      <p className="leaflet-disclaimer">
        {isConnected
          ? 'Short links are generated by a self-hosted '
          : 'Optionally shorten share links via a self-hosted '}
        <a
          href={LEAFLET_SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="leaflet-disclaimer-link"
        >
          Leaflet
        </a>
        {' instance owned by this site.'}
      </p>
    </div>
  );
}
