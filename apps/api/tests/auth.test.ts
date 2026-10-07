// /api/auth integration tests (TEST_PLAN §3.2, T-AUTH-01…22) against the real tidyr_test database.
import { randomUUID } from 'node:crypto';
import type { AuthResult, TokenPair, User } from '@tidyr/shared';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { generateTokenSecret, hashTokenSecret } from '../src/lib/tokens';
import { resetDb } from './helpers/db';
import { createUser, loginAs, sessionIdOf, TEST_PASSWORD } from './helpers/factories';
import { createClient, dataOf, errorOf, type TestClient } from './helpers/http';

const REGISTER = '/api/auth/register';
const LOGIN = '/api/auth/login';
const REFRESH = '/api/auth/refresh';
const LOGOUT = '/api/auth/logout';
const ME = '/api/auth/me';

const REFRESH_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/;
const newUser = { fullName: 'Demo User', email: 'demo@tidyr.test', password: TEST_PASSWORD };
const bearer = (token: string) => `Bearer ${token}`;

// A fresh app per test: every test starts with empty limiter stores (register allows 5 in tests).
let request: TestClient;

beforeEach(async () => {
  await resetDb();
  request = createClient();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const me = (accessToken: string) => request.get(ME).set('Authorization', bearer(accessToken));
const refresh = (refreshToken: string) => request.post(REFRESH).send({ refreshToken });

function signWith(
  claims: object,
  options: jwt.SignOptions = {},
  secret: string = env.JWT_SECRET,
): string {
  return jwt.sign(claims, secret, { algorithm: 'HS256', expiresIn: '15m', ...options });
}

async function setRotatedAt(tokens: TokenPair, secondsAgo: number) {
  await prisma.session.update({
    where: { id: sessionIdOf(tokens) },
    data: { rotatedAt: new Date(Date.now() - secondsAgo * 1000) },
  });
}

/**
 * After two refreshes of one token, neither rotation may have overwritten the other: one pair holds
 * the session's current token and the other its just-rotated previous one (usable in the grace window).
 */
async function expectBothPairsLive(first: TokenPair, second: TokenPair) {
  const pairs = [first, second];
  const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionIdOf(first) } });
  expect(session.revokedAt).toBeNull();
  const hashes = pairs.map((pair) => hashTokenSecret(pair.refreshToken.split('.')[1] ?? ''));
  expect(hashes.sort()).toEqual([session.refreshTokenHash, session.previousTokenHash].sort());
  for (const pair of pairs) await me(pair.accessToken).expect(200);
}

describe('POST /api/auth/register', () => {
  it('T-AUTH-01 creates the user and a session and returns the allow-listed user + tokens', async () => {
    const res = await request
      .post(REGISTER)
      .set('User-Agent', 'x'.repeat(300))
      .send(newUser)
      .expect(201);
    const { user, accessToken, refreshToken } = dataOf<AuthResult>(res);

    expect(Object.keys(dataOf<AuthResult>(res)).sort()).toEqual([
      'accessToken',
      'refreshToken',
      'user',
    ]);
    expect(user).toEqual({
      id: expect.any(String) as string,
      fullName: 'Demo User',
      email: 'demo@tidyr.test',
      createdAt: expect.any(String) as string,
    });
    expect(new Date(user.createdAt).toISOString()).toBe(user.createdAt);
    expect(res.text).not.toMatch(/password/i);
    expect(refreshToken).toMatch(REFRESH_TOKEN_PATTERN);

    const session = await prisma.session.findUniqueOrThrow({
      where: { id: sessionIdOf({ accessToken, refreshToken }) },
    });
    expect(session.userId).toBe(user.id);
    expect(session.userAgent).toHaveLength(255);
    await me(accessToken).expect(200);
  });

  it('T-AUTH-02 stores a bcrypt hash, never the plaintext, and only a SHA-256 of the refresh secret', async () => {
    const res = await request.post(REGISTER).send(newUser).expect(201);
    const { user, refreshToken } = dataOf<AuthResult>(res);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(row.passwordHash).not.toContain(TEST_PASSWORD);
    await expect(bcrypt.compare(TEST_PASSWORD, row.passwordHash)).resolves.toBe(true);

    const [sessionId, secret = ''] = refreshToken.split('.');
    const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.refreshTokenHash).toBe(hashTokenSecret(secret));
    expect(session.refreshTokenHash).not.toContain(secret);
  });

  it('T-AUTH-03 rejects a duplicate email in a different case with 409 EMAIL_TAKEN', async () => {
    await request.post(REGISTER).send(newUser).expect(201);
    const res = await request
      .post(REGISTER)
      .send({ ...newUser, email: '  DEMO@Tidyr.TEST ' })
      .expect(409);

    expect(errorOf(res).code).toBe('EMAIL_TAKEN');
    expect(errorOf(res).details).toEqual([
      { path: 'email', message: expect.any(String) as string },
    ]);
    await expect(prisma.user.count()).resolves.toBe(1);
    await expect(prisma.session.count()).resolves.toBe(1);
  });

  it.each([
    ['an invalid email', { email: 'not-an-email' }, 'email'],
    ['a short password', { password: 'Pass1' }, 'password'],
    ['a password without a number', { password: 'Password!' }, 'password'],
    ['a missing name', { fullName: undefined }, 'fullName'],
    ['a whitespace-only name', { fullName: '    ' }, 'fullName'],
  ])('T-AUTH-04 rejects %s with 400 VALIDATION_ERROR', async (_case, override, path) => {
    const res = await request
      .post(REGISTER)
      .send({ ...newUser, ...override })
      .expect(400);

    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    expect(errorOf(res).details?.map((detail) => detail.path)).toEqual([path]);
    await expect(prisma.user.count()).resolves.toBe(0);
  });

  it('T-AUTH-19 ignores unknown body fields (role, id)', async () => {
    const suppliedId = randomUUID();
    const res = await request
      .post(REGISTER)
      .send({ ...newUser, role: 'admin', id: suppliedId })
      .expect(201);
    const { user } = dataOf<AuthResult>(res);

    expect(user.id).not.toBe(suppliedId);
    expect(user).not.toHaveProperty('role');
    await expect(prisma.user.findUnique({ where: { id: suppliedId } })).resolves.toBeNull();
  });
});

describe('POST /api/auth/login', () => {
  it('T-AUTH-05 logs in with the email in any case and returns user + tokens', async () => {
    const created = await createUser({ email: 'demo@tidyr.test' });
    const res = await request
      .post(LOGIN)
      .send({ email: '  DEMO@TIDYR.TEST ', password: TEST_PASSWORD })
      .expect(200);
    const { user, accessToken, refreshToken } = dataOf<AuthResult>(res);

    expect(user).toEqual({
      id: created.id,
      fullName: created.fullName,
      email: 'demo@tidyr.test',
      createdAt: expect.any(String) as string,
    });
    expect(refreshToken).toMatch(REFRESH_TOKEN_PATTERN);
    expect(dataOf<User>(await me(accessToken).expect(200))).toEqual(user);
  });

  it('T-AUTH-06 answers a wrong password and an unknown email identically, running bcrypt for both', async () => {
    await createUser({ email: 'demo@tidyr.test' });
    const compare = vi.spyOn(bcrypt, 'compare');

    const wrongPassword = await request
      .post(LOGIN)
      .send({ email: 'demo@tidyr.test', password: 'Wr0ngPassword' })
      .expect(401);
    const unknownEmail = await request
      .post(LOGIN)
      .send({ email: 'nobody@tidyr.test', password: TEST_PASSWORD })
      .expect(401);

    expect(errorOf(wrongPassword)).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
    expect(unknownEmail.body).toEqual(wrongPassword.body);
    // Timing equalization: the unknown email still pays for a bcrypt compare.
    expect(compare).toHaveBeenCalledTimes(2);
  });

  it('deletes sessions that expired or were revoked more than 7 days ago', async () => {
    const user = await createUser();
    const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
    const session = (data: { expiresAt: Date; revokedAt?: Date }) =>
      prisma.session.create({
        data: {
          userId: user.id,
          refreshTokenHash: hashTokenSecret(generateTokenSecret()),
          ...data,
        },
      });
    const expiredLongAgo = await session({ expiresAt: daysAgo(8) });
    const revokedLongAgo = await session({ expiresAt: daysAgo(-20), revokedAt: daysAgo(8) });
    const revokedRecently = await session({ expiresAt: daysAgo(-20), revokedAt: daysAgo(1) });
    const live = await session({ expiresAt: daysAgo(-20) });

    const tokens = await loginAs(request, user);

    const remaining = await prisma.session.findMany({ select: { id: true } });
    expect(remaining.map((row) => row.id).sort()).toEqual(
      [revokedRecently.id, live.id, sessionIdOf(tokens)].sort(),
    );
    expect(remaining.map((row) => row.id)).not.toContain(expiredLongAgo.id);
    expect(remaining.map((row) => row.id)).not.toContain(revokedLongAgo.id);
  });
});

describe('GET /api/auth/me', () => {
  it('T-AUTH-07 returns exactly {id, fullName, email, createdAt}', async () => {
    const user = await createUser();
    const { accessToken } = await loginAs(request, user);
    const res = await me(accessToken).expect(200);

    expect(Object.keys(dataOf<User>(res)).sort()).toEqual(['createdAt', 'email', 'fullName', 'id']);
    expect(dataOf<User>(res)).toMatchObject({ id: user.id, email: user.email });
  });

  it.each([
    ['no Authorization header', undefined],
    ['a non-Bearer scheme', 'Basic dXNlcjpwYXNz'],
    ['an empty Bearer value', 'Bearer '],
  ])('T-AUTH-08 %s → 401 UNAUTHENTICATED', async (_case, header) => {
    const res = await request
      .get(ME)
      .set(header === undefined ? {} : { Authorization: header })
      .expect(401);
    expect(errorOf(res).code).toBe('UNAUTHENTICATED');
  });

  it('T-AUTH-09 rejects garbage, wrongly signed, wrong-algorithm and claim-less tokens with TOKEN_INVALID', async () => {
    const user = await createUser();
    const tokens = await loginAs(request, user);
    const sid = sessionIdOf(tokens);
    const otherSecret = 'b'.repeat(32);

    const badTokens = [
      'garbage',
      'not.a.jwt',
      signWith({ sid }, { subject: user.id }, otherSecret),
      jwt.sign({ sid }, env.JWT_SECRET, { algorithm: 'HS512', subject: user.id }),
      signWith({}, { subject: user.id }),
      signWith({ sid: 'not-a-uuid' }, { subject: user.id }),
      `${tokens.accessToken}x`,
    ];
    for (const token of badTokens) {
      const res = await me(token).expect(401);
      expect(errorOf(res).code, token).toBe('TOKEN_INVALID');
    }
  });

  it('T-AUTH-10 rejects an expired token with TOKEN_EXPIRED', async () => {
    const user = await createUser();
    const tokens = await loginAs(request, user);
    const expired = signWith({ sid: sessionIdOf(tokens) }, { subject: user.id, expiresIn: -1 });

    const res = await me(expired).expect(401);
    expect(errorOf(res).code).toBe('TOKEN_EXPIRED');
  });

  it('T-AUTH-11 rejects an alg:none token with TOKEN_INVALID', async () => {
    const user = await createUser();
    const tokens = await loginAs(request, user);
    const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      sub: user.id,
      sid: sessionIdOf(tokens),
      iat: now,
      exp: now + 900,
    })}.`;

    const res = await me(unsigned).expect(401);
    expect(errorOf(res).code).toBe('TOKEN_INVALID');
  });

  it('T-AUTH-20 rejects the token of a deleted user', async () => {
    const user = await createUser();
    const { accessToken } = await loginAs(request, user);
    await prisma.user.delete({ where: { id: user.id } });

    const res = await me(accessToken).expect(401);
    expect(errorOf(res).code).toBe('SESSION_REVOKED');
  });

  it('rejects a validly signed token whose session belongs to another user or has expired', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const bobTokens = await loginAs(request, bob);
    const forged = signWith({ sid: sessionIdOf(bobTokens) }, { subject: alice.id });
    expect(errorOf(await me(forged).expect(401)).code).toBe('SESSION_REVOKED');

    await prisma.session.update({
      where: { id: sessionIdOf(bobTokens) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(errorOf(await me(bobTokens.accessToken).expect(401)).code).toBe('SESSION_REVOKED');
  });
});

describe('POST /api/auth/logout', () => {
  it('T-AUTH-12 returns 204, then the same access token gets 401 SESSION_REVOKED', async () => {
    const user = await createUser();
    const tokens = await loginAs(request, user);

    const res = await request
      .post(LOGOUT)
      .set('Authorization', bearer(tokens.accessToken))
      .expect(204);
    expect(res.text).toBe('');

    expect(errorOf(await me(tokens.accessToken).expect(401)).code).toBe('SESSION_REVOKED');
    expect(errorOf(await refresh(tokens.refreshToken).expect(401)).code).toBe(
      'INVALID_REFRESH_TOKEN',
    );
  });

  it('T-AUTH-13 revokes only the current session', async () => {
    const user = await createUser();
    const phone = await loginAs(request, user);
    const laptop = await loginAs(request, user);

    await request.post(LOGOUT).set('Authorization', bearer(phone.accessToken)).expect(204);

    await me(laptop.accessToken).expect(200);
    await refresh(laptop.refreshToken).expect(200);
    await expect(prisma.session.count({ where: { revokedAt: null } })).resolves.toBe(1);
  });

  it('requires authentication', async () => {
    const res = await request.post(LOGOUT).expect(401);
    expect(errorOf(res).code).toBe('UNAUTHENTICATED');
  });
});

describe('POST /api/auth/refresh', () => {
  it('T-AUTH-14 rotates: returns a new pair, slides the expiry, and the old token fails after the grace window', async () => {
    const user = await createUser();
    const original = await loginAs(request, user);
    const sessionId = sessionIdOf(original);
    await prisma.session.update({
      where: { id: sessionId },
      data: { expiresAt: new Date(Date.now() + 86_400_000) },
    });

    const res = await refresh(original.refreshToken).expect(200);
    const rotated = dataOf<TokenPair>(res);

    expect(Object.keys(rotated).sort()).toEqual(['accessToken', 'refreshToken']);
    expect(rotated.refreshToken).toMatch(REFRESH_TOKEN_PATTERN);
    expect(rotated.refreshToken).not.toBe(original.refreshToken);
    expect(sessionIdOf(rotated)).toBe(sessionId);
    await me(rotated.accessToken).expect(200);

    const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    const thirtyDays = env.REFRESH_TOKEN_TTL_DAYS * 86_400_000;
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now() + thirtyDays - 60_000);

    // Inside the grace window the old token still counts as a retry (T-AUTH-21); past it, it fails.
    await setRotatedAt(rotated, env.REFRESH_REUSE_GRACE_SECONDS + 1);
    const reused = await refresh(original.refreshToken).expect(401);
    expect(errorOf(reused).code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('T-AUTH-15 treats reuse after the grace window as theft and revokes the session', async () => {
    const user = await createUser();
    const original = await loginAs(request, user);
    const rotated = dataOf<TokenPair>(await refresh(original.refreshToken).expect(200));
    await setRotatedAt(rotated, 120);

    const res = await refresh(original.refreshToken).expect(401);
    expect(errorOf(res).code).toBe('INVALID_REFRESH_TOKEN');

    const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionIdOf(rotated) } });
    expect(session.revokedAt).not.toBeNull();
    expect(errorOf(await me(rotated.accessToken).expect(401)).code).toBe('SESSION_REVOKED');
    expect(errorOf(await refresh(rotated.refreshToken).expect(401)).code).toBe(
      'INVALID_REFRESH_TOKEN',
    );
  });

  it.each([
    ['no separator', 'abc'],
    ['a non-uuid session id', `not-a-uuid.${'a'.repeat(43)}`],
    ['a short secret', `${randomUUID()}.short`],
    ['an extra segment', `${randomUUID()}.${'a'.repeat(43)}.extra`],
    ['an unknown session', `${randomUUID()}.${'a'.repeat(43)}`],
  ])('T-AUTH-16 rejects a token with %s', async (_case, refreshToken) => {
    const res = await refresh(refreshToken).expect(401);
    expect(errorOf(res).code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('T-AUTH-16 rejects an empty token with VALIDATION_ERROR', async () => {
    const res = await refresh('').expect(400);
    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
  });

  it('T-AUTH-16 rejects the token of a revoked or expired session', async () => {
    const user = await createUser();
    const revoked = await loginAs(request, user);
    await request.post(LOGOUT).set('Authorization', bearer(revoked.accessToken)).expect(204);
    expect(errorOf(await refresh(revoked.refreshToken).expect(401)).code).toBe(
      'INVALID_REFRESH_TOKEN',
    );

    const expired = await loginAs(request, user);
    await prisma.session.update({
      where: { id: sessionIdOf(expired) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(errorOf(await refresh(expired.refreshToken).expect(401)).code).toBe(
      'INVALID_REFRESH_TOKEN',
    );
  });

  it('revokes the session when its id is presented with a secret it never issued', async () => {
    const user = await createUser();
    const tokens = await loginAs(request, user);
    const forged = `${sessionIdOf(tokens)}.${generateTokenSecret()}`;

    expect(errorOf(await refresh(forged).expect(401)).code).toBe('INVALID_REFRESH_TOKEN');
    expect(errorOf(await me(tokens.accessToken).expect(401)).code).toBe('SESSION_REVOKED');
  });

  it('T-AUTH-21 accepts the old token again within the grace window and keeps the session', async () => {
    const user = await createUser();
    const original = await loginAs(request, user);
    const first = dataOf<TokenPair>(await refresh(original.refreshToken).expect(200));

    const retry = dataOf<TokenPair>(await refresh(original.refreshToken).expect(200));

    expect(retry.refreshToken).not.toBe(first.refreshToken);
    expect(sessionIdOf(retry)).toBe(sessionIdOf(original));
    await me(retry.accessToken).expect(200);
    await me(first.accessToken).expect(200);
    const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionIdOf(retry) } });
    expect(session.revokedAt).toBeNull();
    await refresh(retry.refreshToken).expect(200);
  });

  it('lets two concurrent refreshes of one token both succeed (two tabs, D-016)', async () => {
    const user = await createUser();
    const tokens = await loginAs(request, user);

    const [a, b] = await Promise.all([refresh(tokens.refreshToken), refresh(tokens.refreshToken)]);

    expect([a.status, b.status]).toEqual([200, 200]);
    await expectBothPairsLive(dataOf<TokenPair>(a), dataOf<TokenPair>(b));
  });

  it('resolves a real race: both requests read the session before either rotates', async () => {
    const user = await createUser();
    const tokens = await loginAs(request, user);

    // Hold the first two session reads until both have happened, so both see the same hash.
    const findUnique = prisma.session.findUnique.bind(prisma.session);
    let arrived = 0;
    let release = () => {};
    const bothRead = new Promise<void>((resolve) => {
      release = resolve;
    });
    const heldUntilBothRead = async (args: Parameters<typeof findUnique>[0]) => {
      const row = await findUnique(args);
      arrived += 1;
      if (arrived === 2) release();
      await bothRead;
      return row;
    };
    // A plain Promise instead of Prisma's chainable result: the service only awaits it.
    vi.spyOn(prisma.session, 'findUnique').mockImplementation(
      heldUntilBothRead as unknown as typeof findUnique,
    );

    const [a, b] = await Promise.all([refresh(tokens.refreshToken), refresh(tokens.refreshToken)]);
    vi.restoreAllMocks();

    expect(arrived).toBeGreaterThanOrEqual(3); // the loser re-read the session once
    expect([a.status, b.status]).toEqual([200, 200]);
    await expectBothPairsLive(dataOf<TokenPair>(a), dataOf<TokenPair>(b));
  });
});

describe('rate limits', () => {
  it('T-AUTH-17 limits failed logins per IP + email: N+1 → 429 RATE_LIMITED with Retry-After', async () => {
    const user = await createUser();
    for (let attempt = 0; attempt < env.RATE_LIMIT_AUTH_MAX; attempt += 1) {
      await request.post(LOGIN).send({ email: user.email, password: 'Wr0ngPassword' }).expect(401);
    }

    const limited = await request
      .post(LOGIN)
      .send({ email: user.email, password: 'Wr0ngPassword' })
      .expect(429);
    expect(errorOf(limited).code).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);

    // The pair stays locked even with the right password, and the email's case doesn't matter.
    await request
      .post(LOGIN)
      .send({ email: user.email.toUpperCase(), password: user.password })
      .expect(429);
  });

  it('does not count successful logins', async () => {
    const user = await createUser();
    for (let attempt = 0; attempt <= env.RATE_LIMIT_AUTH_MAX; attempt += 1) {
      await loginAs(request, user);
    }
  });

  it('T-AUTH-22 still lets another email log in from the same IP', async () => {
    const victim = await createUser();
    const other = await createUser();
    for (let attempt = 0; attempt <= env.RATE_LIMIT_AUTH_MAX; attempt += 1) {
      await request.post(LOGIN).send({ email: victim.email, password: 'Wr0ngPassword' });
    }
    await request.post(LOGIN).send({ email: victim.email, password: victim.password }).expect(429);

    await loginAs(request, other);
  });

  it('T-AUTH-18 limits registrations per IP', async () => {
    for (let n = 0; n < env.RATE_LIMIT_REGISTER_MAX; n += 1) {
      await request
        .post(REGISTER)
        .send({ ...newUser, email: `user${n}@tidyr.test` })
        .expect(201);
    }

    const res = await request
      .post(REGISTER)
      .send({ ...newUser, email: 'one-more@tidyr.test' })
      .expect(429);
    expect(errorOf(res).code).toBe('RATE_LIMITED');
    expect(res.headers['retry-after']).toBeDefined();
    await expect(prisma.user.count()).resolves.toBe(env.RATE_LIMIT_REGISTER_MAX);
  });

  it('limits refreshes to 60 per 15 minutes per IP', async () => {
    const malformed = 'not-a-refresh-token';
    for (let n = 0; n < 60; n += 1) {
      await refresh(malformed).expect(401);
    }
    expect(errorOf(await refresh(malformed).expect(429)).code).toBe('RATE_LIMITED');
  });
});
