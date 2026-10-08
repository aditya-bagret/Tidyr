import type { TokenPair, TokenStore } from '@tidyr/shared';

const REFRESH_TOKEN_KEY = 'tidyr.refreshToken';

// localStorage throws in some privacy modes; treat that as "nothing stored" rather than crashing.
function readRefreshToken(): string | null {
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * D-004: the access token lives in memory only (gone after a reload, then refreshed); the refresh
 * token is in localStorage so it survives reloads and is shared by every tab.
 */
export function createWebTokenStore(): TokenStore & { hasRefreshToken(): boolean } {
  let accessToken: string | null = null;

  return {
    getAccessToken: () => Promise.resolve(accessToken),
    // Always read from storage: another tab may have rotated it since this tab last looked.
    getRefreshToken: () => Promise.resolve(readRefreshToken()),
    setTokens(tokens: TokenPair) {
      accessToken = tokens.accessToken;
      window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      return Promise.resolve();
    },
    clear() {
      accessToken = null;
      try {
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      } catch {
        // Nothing stored, nothing to remove.
      }
      return Promise.resolve();
    },
    hasRefreshToken: () => readRefreshToken() !== null,
  };
}
