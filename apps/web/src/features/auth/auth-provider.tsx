'use client';

import {
  isApiError,
  type LoginInput,
  type RegisterInput,
  type SessionExpiredReason,
  type User,
} from '@tidyr/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, onSessionExpired, tokenStore } from '@/lib/api';

type AuthState =
  | { status: 'booting' }
  | { status: 'authenticated'; user: User }
  /** `reason` is set when the session ended on its own, so Login can say why. */
  | { status: 'unauthenticated'; reason: SessionExpiredReason | null }
  /** Boot couldn't reach the API (network, 429, 5xx); the tokens are kept for a retry. */
  | { status: 'error'; error: unknown };

interface AuthContextValue {
  state: AuthState;
  login: (input: LoginInput) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  retryBoot: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * APP_FLOW §3.1 web boot: there's never an access token after a reload, so a stored refresh token
 * is exchanged first, then `me` loads the user. Routing lives in the route-group guards, which
 * react to `state`; this provider only tracks the session.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'booting' });
  const [bootAttempt, setBootAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function boot(): Promise<AuthState> {
      if (!tokenStore.hasRefreshToken()) return { status: 'unauthenticated', reason: null };
      try {
        await api.auth.refresh();
        return { status: 'authenticated', user: await api.auth.me() };
      } catch (error) {
        // A 401 means the stored session is dead (the client has already cleared the tokens).
        if (isApiError(error) && error.status === 401) {
          return { status: 'unauthenticated', reason: 'expired' };
        }
        return { status: 'error', error };
      }
    }

    // StrictMode runs this twice in dev; the client's single-flight refresh makes that one request.
    void boot().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [bootAttempt]);

  useEffect(
    () =>
      onSessionExpired((reason) => {
        setState({ status: 'unauthenticated', reason });
        queryClient.clear();
      }),
    [queryClient],
  );

  const login = useCallback(async (input: LoginInput) => {
    const { user } = await api.auth.login(input);
    setState({ status: 'authenticated', user });
    return user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const { user } = await api.auth.register(input);
    setState({ status: 'authenticated', user });
    return user;
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setState({ status: 'unauthenticated', reason: null });
    queryClient.clear();
  }, [queryClient]);

  const retryBoot = useCallback(() => {
    setState({ status: 'booting' });
    setBootAttempt((attempt) => attempt + 1);
  }, []);

  const value = useMemo(
    () => ({ state, login, register, logout, retryBoot }),
    [state, login, register, logout, retryBoot],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** For screens inside the `(app)` guard, which only renders once the user is known. */
export function useCurrentUser(): User {
  const { state } = useAuth();
  if (state.status !== 'authenticated') throw new Error('useCurrentUser needs a signed-in user');
  return state.user;
}
