import { useState } from 'react';
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
          <span className={statusClass(connectionState)}>
            {statusLabel(connectionState, username, retryAfter)}
          </span>
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
