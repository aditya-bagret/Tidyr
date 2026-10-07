import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient, type ApiClientOptions, type TokenStore } from '../src';

const USER = { id: 'u1', fullName: 'Demo User', email: 'demo@tidyr.test', createdAt: '2026-10-07' };

interface Call {
  url: string;
  method: string;
  auth: string | null;
  body: unknown;
}

type Handler = (call: Call, signal: AbortSignal | null) => Response | Promise<Response>;

function json(status: number, body?: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function apiError(status: number, code: string, message = code): Response {
  return json(status, { error: { code, message } });
}

function createTokenStore(accessToken: string | null = 'a1', refreshToken: string | null = 'r1') {
  const state = { accessToken, refreshToken };
  const store = {
    getAccessToken: vi.fn(() => Promise.resolve(state.accessToken)),
    getRefreshToken: vi.fn(() => Promise.resolve(state.refreshToken)),
    setTokens: vi.fn((tokens: { accessToken: string; refreshToken: string }) => {
      Object.assign(state, tokens);
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      state.accessToken = null;
      state.refreshToken = null;
      return Promise.resolve();
    }),
  } satisfies TokenStore;
  return { store, state };
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

function setup(handler: Handler, overrides: Partial<ApiClientOptions> = {}) {
  const { store, state } = createTokenStore();
  const calls: Call[] = [];
  const fetchImpl = vi.fn<typeof fetch>(async (input, init = {}) => {
    const headers = new Headers(init.headers);
    const call: Call = {
      url: urlOf(input),
      method: init.method ?? 'GET',
      auth: headers.get('Authorization'),
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    return handler(call, init.signal ?? null);
  });
  const onSessionExpired = vi.fn();
  const client = createApiClient({
    baseUrl: 'http://api.test/api/',
    tokenStore: store,
    onSessionExpired,
    fetchImpl,
    ...overrides,
  });
  const refreshCalls = () => calls.filter((call) => call.url.endsWith('/auth/refresh'));
  return { client, store, state, calls, refreshCalls, fetchImpl, onSessionExpired };
}

/** Access token a1 is stale; refreshing r1 gives a2/r2, which works. */
const staleThenRefreshed =
  (staleCode: string): Handler =>
  ({ url, auth, body }) => {
    if (url.endsWith('/auth/refresh')) {
      return (body as { refreshToken: string }).refreshToken === 'r1'
        ? json(200, { data: { accessToken: 'a2', refreshToken: 'r2' } })
        : apiError(401, 'INVALID_REFRESH_TOKEN');
    }
    if (auth === 'Bearer a1') return apiError(401, staleCode);
    return json(200, { data: USER });
  };

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  const error: unknown = await promise.then(
    () => {
      throw new Error('expected a rejection');
    },
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe('requests and responses', () => {
  it('unwraps data, sends the bearer token and builds CSV query strings', async () => {
    const { client, calls } = setup(() =>
      json(200, { data: [], meta: { page: 2, limit: 20, total: 0, totalPages: 0 } }),
    );
    const result = await client.tasks.list({
      status: ['PENDING', 'IN_PROGRESS'],
      search: 'web 12',
      page: 2,
      due: undefined,
    });

    expect(result).toEqual({ data: [], meta: { page: 2, limit: 20, total: 0, totalPages: 0 } });
    expect(calls[0]).toMatchObject({
      url: 'http://api.test/api/tasks?status=PENDING,IN_PROGRESS&search=web%2012&page=2',
      method: 'GET',
      auth: 'Bearer a1',
    });
  });

  it('resolves a 204 to undefined and encodes ids in the path', async () => {
    const { client, calls } = setup(() => new Response(null, { status: 204 }));
    await expect(client.projects.remove('a/b')).resolves.toBeUndefined();
    expect(calls[0]?.url).toBe('http://api.test/api/projects/a%2Fb');
  });

  it('login stores the returned tokens and never sends a bearer token', async () => {
    const { client, store, calls } = setup(() =>
      json(200, { data: { user: USER, accessToken: 'a9', refreshToken: 'r9' } }),
    );
    const result = await client.auth.login({ email: 'demo@tidyr.test', password: 'Passw0rd!' });

    expect(result.user).toEqual(USER);
    expect(store.setTokens).toHaveBeenCalledWith({ accessToken: 'a9', refreshToken: 'r9' });
    expect(calls[0]?.auth).toBeNull();
  });

  it('maps the error envelope, details and Retry-After onto ApiError', async () => {
    const { client } = setup(() =>
      json(
        429,
        { error: { code: 'RATE_LIMITED', message: 'Too many requests', requestId: 'req-1' } },
        { 'Retry-After': '120' },
      ),
    );
    const error = await rejection(client.projects.get('p1'));
    expect(error).toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      retryAfter: 120,
      requestId: 'req-1',
    });
  });

  it('keeps validation details for form mapping', async () => {
    const details = [{ path: 'endDate', message: 'End date must be on or after start date' }];
    const { client } = setup(() =>
      json(400, { error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details } }),
    );
    const error = await rejection(client.projects.create({ name: 'Web' }));
    expect(error.details).toEqual(details);
  });

  it('falls back to INTERNAL_ERROR when the body is not the API envelope', async () => {
    const { client } = setup(() => new Response('<html>Bad gateway</html>', { status: 502 }));
    const error = await rejection(client.dashboard.get({ today: '2026-10-07' }));
    expect(error).toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
  });
});

describe('token refresh', () => {
  it('T-SH-10: 401 TOKEN_EXPIRED → refresh → retries once with the new token', async () => {
    const { client, store, calls, onSessionExpired } = setup(staleThenRefreshed('TOKEN_EXPIRED'));

    await expect(client.auth.me()).resolves.toEqual(USER);

    expect(calls.map((call) => [call.url.replace('http://api.test/api', ''), call.auth])).toEqual([
      ['/auth/me', 'Bearer a1'],
      ['/auth/refresh', null],
      ['/auth/me', 'Bearer a2'],
    ]);
    expect(calls[1]?.body).toEqual({ refreshToken: 'r1' });
    expect(store.setTokens).toHaveBeenCalledWith({ accessToken: 'a2', refreshToken: 'r2' });
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('T-SH-11: three concurrent 401s share one refresh call', async () => {
    const handler = staleThenRefreshed('TOKEN_EXPIRED');
    const { client, refreshCalls } = setup(async (call, signal) => {
      // Hold the refresh open so every request has hit its 401 before it settles.
      if (call.url.endsWith('/auth/refresh')) await new Promise((r) => setTimeout(r, 20));
      return handler(call, signal);
    });

    const results = await Promise.all([client.auth.me(), client.auth.me(), client.auth.me()]);

    expect(results).toEqual([USER, USER, USER]);
    expect(refreshCalls()).toHaveLength(1);
  });

  it('T-SH-12: a failed refresh clears tokens and calls onSessionExpired("expired") once', async () => {
    const { client, store, state, onSessionExpired } = setup(({ url }) =>
      url.endsWith('/auth/refresh')
        ? apiError(401, 'INVALID_REFRESH_TOKEN')
        : apiError(401, 'TOKEN_EXPIRED'),
    );

    const errors = await Promise.all([
      rejection(client.auth.me()),
      rejection(client.projects.list()),
      rejection(client.tasks.list()),
    ]);

    expect(errors.map((error) => error.code)).toEqual([
      'INVALID_REFRESH_TOKEN',
      'INVALID_REFRESH_TOKEN',
      'INVALID_REFRESH_TOKEN',
    ]);
    expect(store.clear).toHaveBeenCalled();
    expect(state).toEqual({ accessToken: null, refreshToken: null });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).toHaveBeenCalledWith('expired');
  });

  it('notifies again for a new session after a new login', async () => {
    let loggedIn = false;
    const { client, onSessionExpired } = setup(({ url }) => {
      if (url.endsWith('/auth/login')) {
        loggedIn = true;
        return json(200, { data: { user: USER, accessToken: 'a5', refreshToken: 'r5' } });
      }
      return apiError(401, loggedIn ? 'TOKEN_INVALID' : 'UNAUTHENTICATED');
    });

    await rejection(client.auth.me());
    await client.auth.login({ email: 'demo@tidyr.test', password: 'Passw0rd!' });
    await rejection(client.auth.me());

    expect(onSessionExpired).toHaveBeenCalledTimes(2);
  });

  it('T-SH-15: 401 SESSION_REVOKED → one refresh attempt → refresh 401 → "expired"', async () => {
    const { client, calls, refreshCalls, onSessionExpired } = setup(({ url }) =>
      url.endsWith('/auth/refresh')
        ? apiError(401, 'INVALID_REFRESH_TOKEN')
        : apiError(401, 'SESSION_REVOKED'),
    );

    await rejection(client.auth.me());

    expect(calls).toHaveLength(2);
    expect(refreshCalls()).toHaveLength(1);
    expect(onSessionExpired).toHaveBeenCalledWith('expired');
  });

  it.each(['TOKEN_INVALID', 'UNAUTHENTICATED'])(
    'T-SH-15: 401 %s → onSessionExpired("invalid") with no refresh',
    async (code) => {
      const { client, store, refreshCalls, onSessionExpired } = setup(() => apiError(401, code));

      const error = await rejection(client.projects.list());

      expect(error.code).toBe(code);
      expect(refreshCalls()).toHaveLength(0);
      expect(store.clear).toHaveBeenCalled();
      expect(onSessionExpired).toHaveBeenCalledExactlyOnceWith('invalid');
    },
  );

  it('does not loop when the retried request is rejected again', async () => {
    const { client, calls, onSessionExpired } = setup(({ url }) =>
      url.endsWith('/auth/refresh')
        ? json(200, { data: { accessToken: 'a2', refreshToken: 'r2' } })
        : apiError(401, 'SESSION_REVOKED'),
    );

    await rejection(client.auth.me());

    expect(calls).toHaveLength(3);
    expect(onSessionExpired).toHaveBeenCalledExactlyOnceWith('expired');
  });

  it('T-SH-16: refresh runs inside runExclusive and re-reads the token, so a waiting tab uses the rotated one', async () => {
    // Two "tabs" share storage and a lock, like localStorage + navigator.locks on web.
    const { store } = createTokenStore();
    let tail: Promise<unknown> = Promise.resolve();
    let lockRequests = 0;
    // A plain generic function: vi.fn() would erase the <T> that ApiClientOptions requires.
    const runExclusive = <T>(fn: () => Promise<T>): Promise<T> => {
      lockRequests += 1;
      const run = tail.then(fn);
      tail = run.catch(() => undefined);
      return run;
    };
    const rotations: Record<string, { accessToken: string; refreshToken: string }> = {
      r1: { accessToken: 'a2', refreshToken: 'r2' },
      r2: { accessToken: 'a3', refreshToken: 'r3' },
    };
    const refreshBodies: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>((input, init = {}) => {
      const url = urlOf(input);
      if (url.endsWith('/auth/refresh')) {
        const { refreshToken } = JSON.parse(init.body as string) as { refreshToken: string };
        refreshBodies.push(refreshToken);
        const next = rotations[refreshToken];
        return Promise.resolve(
          next ? json(200, { data: next }) : apiError(401, 'INVALID_REFRESH_TOKEN'),
        );
      }
      const auth = new Headers(init.headers).get('Authorization');
      return Promise.resolve(
        auth === 'Bearer a1' ? apiError(401, 'TOKEN_EXPIRED') : json(200, { data: USER }),
      );
    });
    const onSessionExpired = vi.fn();
    const options = {
      baseUrl: 'http://api.test/api',
      tokenStore: store,
      onSessionExpired,
      fetchImpl,
      runExclusive,
    };
    const tabA = createApiClient(options);
    const tabB = createApiClient(options);

    await expect(Promise.all([tabA.auth.me(), tabB.auth.me()])).resolves.toEqual([USER, USER]);

    expect(lockRequests).toBe(2);
    expect(refreshBodies).toEqual(['r1', 'r2']);
    expect(onSessionExpired).not.toHaveBeenCalled();
    await expect(store.getRefreshToken()).resolves.toBe('r3');
  });

  it('auth.refresh() rotates tokens, and fails without a network call when none is stored', async () => {
    const { client, state, calls, onSessionExpired } = setup(staleThenRefreshed('TOKEN_EXPIRED'));

    await expect(client.auth.refresh()).resolves.toEqual({ accessToken: 'a2', refreshToken: 'r2' });
    expect(state.refreshToken).toBe('r2');

    state.refreshToken = null;
    const error = await rejection(client.auth.refresh());
    expect(error.code).toBe('INVALID_REFRESH_TOKEN');
    expect(calls).toHaveLength(1);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });
});

describe('auth endpoints never start the session-expired flow (T-SH-13)', () => {
  it('login 401 INVALID_CREDENTIALS rejects without refreshing or notifying', async () => {
    const { client, store, refreshCalls, onSessionExpired } = setup(() =>
      apiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'),
    );

    const error = await rejection(client.auth.login({ email: 'a@b.co', password: 'nope' }));

    expect(error.code).toBe('INVALID_CREDENTIALS');
    expect(refreshCalls()).toHaveLength(0);
    expect(store.clear).not.toHaveBeenCalled();
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('a failed logout still resolves and clears tokens', async () => {
    const { client, state, onSessionExpired } = setup(() => apiError(500, 'INTERNAL_ERROR'));

    await expect(client.auth.logout()).resolves.toBeUndefined();

    expect(state).toEqual({ accessToken: null, refreshToken: null });
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it.each(['TOKEN_INVALID', 'SESSION_REVOKED'])(
    'logout with a 401 %s stays silent',
    async (code) => {
      const { client, state, onSessionExpired } = setup(({ url }) =>
        url.endsWith('/auth/refresh')
          ? apiError(401, 'INVALID_REFRESH_TOKEN')
          : apiError(401, code),
      );

      await client.auth.logout();

      expect(state).toEqual({ accessToken: null, refreshToken: null });
      expect(onSessionExpired).not.toHaveBeenCalled();
    },
  );

  it('logout with an expired access token refreshes first so the server session is revoked', async () => {
    const { client, calls } = setup(({ url, auth }) => {
      if (url.endsWith('/auth/refresh')) {
        return json(200, { data: { accessToken: 'a2', refreshToken: 'r2' } });
      }
      return auth === 'Bearer a1'
        ? apiError(401, 'TOKEN_EXPIRED')
        : new Response(null, { status: 204 });
    });

    await client.auth.logout();

    expect(calls.at(-1)).toMatchObject({ method: 'POST', auth: 'Bearer a2' });
    expect(calls.at(-1)?.url).toMatch(/\/auth\/logout$/);
  });

  it('requests that 401 after logout do not notify', async () => {
    const { client, onSessionExpired } = setup(({ url }) =>
      url.endsWith('/auth/logout')
        ? new Response(null, { status: 204 })
        : apiError(401, 'UNAUTHENTICATED'),
    );

    await client.auth.logout();
    await rejection(client.projects.list());

    expect(onSessionExpired).not.toHaveBeenCalled();
  });
});

describe('network failures (T-SH-14)', () => {
  it('maps a thrown fetch to NETWORK_ERROR with status 0', async () => {
    const { client } = setup(() => {
      throw new TypeError('Failed to fetch');
    });
    const error = await rejection(client.projects.list());
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('maps a timeout abort to TIMEOUT', async () => {
    const { client } = setup(
      (_call, signal) =>
        new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
      { timeoutMs: 10 },
    );
    const error = await rejection(client.projects.list());
    expect(error).toMatchObject({ status: 0, code: 'TIMEOUT' });
  });

  it('a network error during refresh keeps the tokens and does not notify', async () => {
    const { client, store, state, onSessionExpired } = setup(({ url }) => {
      if (url.endsWith('/auth/refresh')) throw new TypeError('Network request failed');
      return apiError(401, 'TOKEN_EXPIRED');
    });

    const error = await rejection(client.auth.me());

    expect(error.code).toBe('NETWORK_ERROR');
    expect(store.clear).not.toHaveBeenCalled();
    expect(state).toEqual({ accessToken: 'a1', refreshToken: 'r1' });
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('a 429 or 500 during refresh also keeps the tokens', async () => {
    const { client, store, onSessionExpired } = setup(({ url }) =>
      url.endsWith('/auth/refresh')
        ? apiError(429, 'RATE_LIMITED')
        : apiError(401, 'TOKEN_EXPIRED'),
    );

    const error = await rejection(client.auth.me());

    expect(error.code).toBe('RATE_LIMITED');
    expect(store.clear).not.toHaveBeenCalled();
    expect(onSessionExpired).not.toHaveBeenCalled();
  });
});
