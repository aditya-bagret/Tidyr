import type { ActivityQuery } from '../schemas/activity';
import type { LoginInput, RegisterInput } from '../schemas/auth';
import type { DashboardQuery } from '../schemas/dashboard';
import type { CreateProjectInput, ListProjectsQuery, UpdateProjectInput } from '../schemas/project';
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from '../schemas/task';
import type {
  ActivityEntry,
  AuthResult,
  Dashboard,
  DataResponse,
  ErrorCode,
  ListResponse,
  Project,
  Task,
  TokenPair,
  User,
} from '../types';
import { ApiError, isApiError, toApiError } from './errors';
import { buildQueryString, type QueryParams } from './query';

export const DEFAULT_TIMEOUT_MS = 15_000;

export interface TokenStore {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setTokens(tokens: TokenPair): Promise<void>;
  clear(): Promise<void>;
}

export type SessionExpiredReason = 'expired' | 'invalid';

export interface ApiClientOptions {
  baseUrl: string;
  tokenStore: TokenStore;
  onSessionExpired: (reason: SessionExpiredReason) => void;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** Web passes a `navigator.locks` wrapper so only one tab refreshes at a time (D-016). */
  runExclusive?: <T>(fn: () => Promise<T>) => Promise<T>;
}

// Client params are the parsed query shapes with every field optional (defaults apply server-side).
export type ListProjectsParams = Partial<ListProjectsQuery>;
export type ListTasksParams = Partial<ListTasksQuery>;
export type ActivityParams = Partial<ActivityQuery>;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RequestOptions {
  body?: unknown;
  query?: QueryParams;
}

// 'silent' is for logout, which must never start the session-expired flow.
type ExpiryMode = 'notify' | 'silent';

// These two mean "your access token is stale": refresh once and retry (TECHNICAL_REQUIREMENTS §5.3).
const REFRESHABLE_CODES: ReadonlySet<ErrorCode> = new Set(['TOKEN_EXPIRED', 'SESSION_REVOKED']);

function isUnauthorized(error: unknown): error is ApiError {
  return isApiError(error) && error.status === 401;
}

function parseJson(text: string): unknown {
  if (text === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function idPath(prefix: string, id: string, suffix = ''): string {
  return `${prefix}/${encodeURIComponent(id)}${suffix}`;
}

export function createApiClient(options: ApiClientOptions) {
  const { tokenStore, onSessionExpired } = options;
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // Resolved per call, not captured, so a polyfilled or test-stubbed global fetch is picked up.
  const fetchImpl: typeof fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const runExclusive = options.runExclusive ?? (<T>(fn: () => Promise<T>) => fn());

  let refreshInFlight: Promise<TokenPair> | null = null;
  // Once a session has ended, requests still in flight will 401 too; notify only once.
  // New tokens (login, register, refresh) start a new session.
  let sessionEnded = false;

  async function send<T>(
    method: HttpMethod,
    path: string,
    { body, query }: RequestOptions,
    accessToken?: string | null,
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let status: number;
    let ok: boolean;
    let retryAfter: string | null;
    let text: string;
    try {
      const response = await fetchImpl(`${baseUrl}${path}${buildQueryString(query)}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      ({ status, ok } = response);
      retryAfter = response.headers.get('Retry-After');
      text = await response.text();
    } catch {
      throw controller.signal.aborted
        ? new ApiError(0, 'TIMEOUT', 'The request timed out')
        : new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server');
    } finally {
      clearTimeout(timer);
    }

    const payload = parseJson(text);
    if (!ok) throw toApiError(status, payload, retryAfter);
    return payload as T;
  }

  async function storeTokens(tokens: TokenPair): Promise<void> {
    await tokenStore.setTokens(tokens);
    sessionEnded = false;
  }

  async function endSession(reason: SessionExpiredReason, mode: ExpiryMode): Promise<void> {
    await tokenStore.clear();
    if (mode === 'silent' || sessionEnded) return;
    sessionEnded = true;
    onSessionExpired(reason);
  }

  /**
   * Single-flight: concurrent callers in this tab share one refresh. `runExclusive` extends that
   * across tabs, and the refresh token is read *inside* it so a tab that waited for the lock uses
   * the token another tab just rotated instead of replaying the old one.
   */
  function refreshTokens(): Promise<TokenPair> {
    refreshInFlight ??= runExclusive(async () => {
      const refreshToken = await tokenStore.getRefreshToken();
      if (!refreshToken) {
        throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'No refresh token');
      }
      try {
        const { data } = await send<DataResponse<TokenPair>>('POST', '/auth/refresh', {
          body: { refreshToken },
        });
        await storeTokens(data);
        return data;
      } catch (error) {
        // A 401 means the refresh token is dead. Network errors, 429 and 5xx keep the tokens.
        if (isUnauthorized(error)) await tokenStore.clear();
        throw error;
      }
    }).finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  }

  async function authed<T>(
    method: HttpMethod,
    path: string,
    request: RequestOptions = {},
    mode: ExpiryMode = 'notify',
  ): Promise<T> {
    try {
      return await send<T>(method, path, request, await tokenStore.getAccessToken());
    } catch (error) {
      if (!isUnauthorized(error)) throw error;
      if (!REFRESHABLE_CODES.has(error.code)) {
        await endSession('invalid', mode);
        throw error;
      }
    }

    let tokens: TokenPair;
    try {
      tokens = await refreshTokens();
    } catch (error) {
      if (isUnauthorized(error)) await endSession('expired', mode);
      throw error;
    }

    // Retry once. A second 401 means the new session is unusable too, so don't loop.
    try {
      return await send<T>(method, path, request, tokens.accessToken);
    } catch (error) {
      if (isUnauthorized(error)) {
        await endSession(REFRESHABLE_CODES.has(error.code) ? 'expired' : 'invalid', mode);
      }
      throw error;
    }
  }

  async function authedData<T>(method: HttpMethod, path: string, request?: RequestOptions) {
    const { data } = await authed<DataResponse<T>>(method, path, request);
    return data;
  }

  async function signIn(path: string, body: RegisterInput | LoginInput): Promise<AuthResult> {
    const { data } = await send<DataResponse<AuthResult>>('POST', path, { body });
    await storeTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data;
  }

  return {
    auth: {
      register: (body: RegisterInput) => signIn('/auth/register', body),
      login: (body: LoginInput) => signIn('/auth/login', body),
      /** Never rejects: local tokens are cleared even if the server call fails. */
      async logout(): Promise<void> {
        try {
          await authed<undefined>('POST', '/auth/logout', {}, 'silent');
        } catch {
          // Ignored on purpose (TECHNICAL_REQUIREMENTS §5.2): the user is signed out locally either way.
        } finally {
          sessionEnded = true;
          await tokenStore.clear();
        }
      },
      me: () => authedData<User>('GET', '/auth/me'),
      refresh: () => refreshTokens(),
    },
    projects: {
      list: (params: ListProjectsParams = {}) =>
        authed<ListResponse<Project>>('GET', '/projects', { query: params }),
      get: (id: string) => authedData<Project>('GET', idPath('/projects', id)),
      create: (body: CreateProjectInput) => authedData<Project>('POST', '/projects', { body }),
      update: (id: string, body: UpdateProjectInput) =>
        authedData<Project>('PUT', idPath('/projects', id), { body }),
      remove: (id: string) => authed<undefined>('DELETE', idPath('/projects', id)),
      activity: (id: string, params: ActivityParams = {}) =>
        authed<ListResponse<ActivityEntry>>('GET', idPath('/projects', id, '/activity'), {
          query: params,
        }),
    },
    tasks: {
      list: (params: ListTasksParams = {}) =>
        authed<ListResponse<Task>>('GET', '/tasks', { query: params }),
      get: (id: string) => authedData<Task>('GET', idPath('/tasks', id)),
      create: (body: CreateTaskInput) => authedData<Task>('POST', '/tasks', { body }),
      update: (id: string, body: UpdateTaskInput) =>
        authedData<Task>('PUT', idPath('/tasks', id), { body }),
      remove: (id: string) => authed<undefined>('DELETE', idPath('/tasks', id)),
      activity: (id: string, params: ActivityParams = {}) =>
        authed<ListResponse<ActivityEntry>>('GET', idPath('/tasks', id, '/activity'), {
          query: params,
        }),
    },
    dashboard: {
      get: (params: DashboardQuery) =>
        authedData<Dashboard>('GET', '/dashboard', { query: params }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
