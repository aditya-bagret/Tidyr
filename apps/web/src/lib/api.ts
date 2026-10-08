import { createApiClient, type SessionExpiredReason } from '@tidyr/shared';
import { API_URL } from './env';
import { createWebTokenStore } from './tokenStore';

const REFRESH_LOCK = 'tidyr-refresh';

/**
 * D-016: two tabs reloaded together must not both spend the same refresh token. The Web Locks API
 * runs one tab's refresh at a time, and the shared client re-reads the token inside the lock.
 */
function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !('locks' in navigator)) return fn();
  return navigator.locks.request(REFRESH_LOCK, fn);
}

type SessionExpiredListener = (reason: SessionExpiredReason) => void;
let sessionExpiredListener: SessionExpiredListener | null = null;

/** AuthProvider registers here; it owns the query cache and routing the client can't see. */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListener = listener;
  return () => {
    if (sessionExpiredListener === listener) sessionExpiredListener = null;
  };
}

export const tokenStore = createWebTokenStore();

export const api = createApiClient({
  baseUrl: API_URL,
  tokenStore,
  runExclusive,
  onSessionExpired: (reason) => sessionExpiredListener?.(reason),
});
