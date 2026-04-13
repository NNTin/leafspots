import { useState, useEffect, useCallback, useRef } from 'react';
import {
  isLeafletOptedIn,
  setLeafletOptIn,
  clearLeafletConnectionCaches,
  getLeafletSession,
  getLeafletCapabilities,
  logoutLeafletSession,
  buildLeafletLoginUrl,
  type SessionResult,
  type LeafletCapabilities,
} from '../lib/leaflet-client';

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'anonymous'
  | 'authenticated'
  | 'rate-limited'
  | 'unavailable';

export interface LeafletConnectionState {
  connectionState: ConnectionState;
  username: string | null;
  retryAfter: number | null;
  capabilities: LeafletCapabilities | null;
  authReturnFailed: boolean;
  connect: (mode: 'anonymous' | 'authenticated') => void;
  disconnect: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  clearAuthReturn: () => void;
}

export function useLeafletConnection(): LeafletConnectionState {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [username, setUsername] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [capabilities, setCapabilities] = useState<LeafletCapabilities | null>(null);
  const [authReturnFailed, setAuthReturnFailed] = useState(false);

  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  const applySessionResult = useCallback(async (result: SessionResult, options?: { force?: boolean }) => {
    if (!isMounted.current) return;

    switch (result.status) {
      case 'anonymous':
        setConnectionState('anonymous');
        setUsername(null);
        setRetryAfter(null);
        break;
      case 'authenticated':
        setConnectionState('authenticated');
        setUsername(result.username);
        setRetryAfter(null);
        break;
      case 'rate-limited':
        setConnectionState('rate-limited');
        setRetryAfter(result.retryAfter);
        break;
      case 'unavailable':
        setConnectionState('unavailable');
        setRetryAfter(null);
        break;
    }

    if (result.status === 'anonymous' || result.status === 'authenticated') {
      const caps = await getLeafletCapabilities({ force: options?.force });
      if (isMounted.current) setCapabilities(caps);
    } else {
      setCapabilities(null);
    }
  }, []);

  const refreshSession = useCallback(async (options?: { force?: boolean }) => {
    if (!isLeafletOptedIn()) return;
    setConnectionState('connecting');
    const result = await getLeafletSession({ force: options?.force });
    if (isMounted.current) await applySessionResult(result, options);
  }, [applySessionResult]);

  // On mount: check for auth-return param and restore session if opted in.
  useEffect(() => {
    const url = new URL(window.location.href);
    const authParam = url.searchParams.get('auth');

    if (authParam === 'failed') {
      setAuthReturnFailed(true);
    }

    // Restore connection if user previously opted in (regardless of auth result).
    if (isLeafletOptedIn()) {
      refreshSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(
    (mode: 'anonymous' | 'authenticated') => {
      setLeafletOptIn(true);
      if (mode === 'anonymous') {
        clearLeafletConnectionCaches();
        refreshSession();
      } else {
        // Preserve full current URL (including hash state) as return target.
        window.location.href = buildLeafletLoginUrl(window.location.href);
      }
    },
    [refreshSession],
  );

  const disconnect = useCallback(() => {
    setLeafletOptIn(false);
    clearLeafletConnectionCaches();
    setConnectionState('disconnected');
    setUsername(null);
    setCapabilities(null);
    setRetryAfter(null);
  }, []);

  const logout = useCallback(async () => {
    await logoutLeafletSession();
    if (isMounted.current) await refreshSession({ force: true });
  }, [refreshSession]);

  const refresh = useCallback(async () => {
    await refreshSession({ force: true });
  }, [refreshSession]);

  const clearAuthReturn = useCallback(() => {
    setAuthReturnFailed(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('auth');
    window.history.replaceState(null, '', url.toString());
  }, []);

  return {
    connectionState,
    username,
    retryAfter,
    capabilities,
    authReturnFailed,
    connect,
    disconnect,
    logout,
    refresh,
    clearAuthReturn,
  };
}
