// Registration, login, refresh rotation and sessions (TECHNICAL_REQUIREMENTS §5).
import type { AuthResult, LoginInput, RegisterInput, TokenPair, User } from '@tidyr/shared';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { Prisma } from '../../generated/prisma/client';
import { emailTaken, unauthorized } from '../../lib/errors';
import { signAccessToken, type AccessTokenClaims } from '../../lib/jwt';
import { hashPassword, verifyPassword } from '../../lib/password';
import { prisma } from '../../lib/prisma';
import {
  formatRefreshToken,
  generateTokenSecret,
  hashTokenSecret,
  parseRefreshToken,
  secretMatchesHash,
  type RefreshTokenParts,
} from '../../lib/tokens';
import { toUserDto, userDtoSelect } from './user.serializer';

const DAY_MS = 86_400_000;
const USER_AGENT_MAX_LENGTH = 255;
const SESSION_RETENTION_DAYS = 7;
// A rotation that loses a race with a concurrent refresh of the same session is retried once,
// when the presented token has become the "previous" one and the grace window applies.
const MAX_ROTATION_ATTEMPTS = 2;

export interface ClientInfo {
  userAgent: string | undefined;
}

const invalidCredentials = () => unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
const invalidRefreshToken = () => unauthorized('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
const sessionRevoked = () => unauthorized('SESSION_REVOKED', 'Session is no longer valid');

const sessionExpiry = (from: Date) =>
  new Date(from.getTime() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS);

function issueTokens(claims: AccessTokenClaims, secret: string): TokenPair {
  return {
    accessToken: signAccessToken(claims),
    refreshToken: formatRefreshToken({ sessionId: claims.sessionId, secret }),
  };
}

async function createSession(
  tx: Prisma.TransactionClient,
  userId: string,
  client: ClientInfo,
): Promise<TokenPair> {
  const secret = generateTokenSecret();
  const session = await tx.session.create({
    data: {
      userId,
      refreshTokenHash: hashTokenSecret(secret),
      userAgent: client.userAgent?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
      expiresAt: sessionExpiry(new Date()),
    },
    select: { id: true },
  });
  return issueTokens({ userId, sessionId: session.id }, secret);
}

export async function register(input: RegisterInput, client: ClientInfo): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { fullName: input.fullName, email: input.email, passwordHash },
        select: userDtoSelect,
      });
      const tokens = await createSession(tx, user.id, client);
      return { user: toUserDto(user), ...tokens };
    });
  } catch (error) {
    // The unique index decides, so two concurrent sign-ups with one email can't both succeed.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw emailTaken();
    }
    throw error;
  }
}

export async function login(input: LoginInput, client: ClientInfo): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...userDtoSelect, passwordHash: true },
  });
  // Always runs bcrypt, even for an unknown email, so timing doesn't reveal which accounts exist.
  const passwordOk = await verifyPassword(input.password, user?.passwordHash ?? null);
  if (!user || !passwordOk) {
    logger.info('auth.login.failed');
    throw invalidCredentials();
  }

  const staleBefore = new Date(Date.now() - SESSION_RETENTION_DAYS * DAY_MS);
  const tokens = await prisma.$transaction(async (tx) => {
    // Housekeeping, so the sessions table doesn't grow forever.
    await tx.session.deleteMany({
      where: {
        userId: user.id,
        OR: [{ expiresAt: { lt: staleBefore } }, { revokedAt: { lt: staleBefore } }],
      },
    });
    return createSession(tx, user.id, client);
  });
  logger.info({ userId: user.id }, 'auth.login.success');
  return { user: toUserDto(user), ...tokens };
}

/** One rotation attempt. Returns null when a concurrent refresh rotated the session first. */
async function rotate({ sessionId, secret }: RefreshTokenParts): Promise<TokenPair | null> {
  const now = new Date();
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      refreshTokenHash: true,
      previousTokenHash: true,
      rotatedAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
  if (!session || session.revokedAt !== null || session.expiresAt <= now) {
    throw invalidRefreshToken();
  }

  const isCurrent = secretMatchesHash(secret, session.refreshTokenHash);
  // A just-rotated token presented again: a lost response or a second tab, not theft (D-016).
  const isGraceRetry =
    !isCurrent &&
    session.previousTokenHash !== null &&
    session.rotatedAt !== null &&
    now.getTime() - session.rotatedAt.getTime() <= env.REFRESH_REUSE_GRACE_SECONDS * 1000 &&
    secretMatchesHash(secret, session.previousTokenHash);

  if (!isCurrent && !isGraceRetry) {
    await prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: now },
    });
    logger.warn({ userId: session.userId, sessionId: session.id }, 'auth.refresh.reuse_detected');
    throw invalidRefreshToken();
  }

  const nextSecret = generateTokenSecret();
  // Conditional on the hash we read, so of two concurrent rotations only one can win.
  const { count } = await prisma.session.updateMany({
    where: { id: session.id, refreshTokenHash: session.refreshTokenHash, revokedAt: null },
    data: {
      previousTokenHash: session.refreshTokenHash,
      refreshTokenHash: hashTokenSecret(nextSecret),
      rotatedAt: now,
      expiresAt: sessionExpiry(now),
    },
  });
  if (count === 0) return null;
  return issueTokens({ userId: session.userId, sessionId: session.id }, nextSecret);
}

export async function refresh(refreshToken: string): Promise<TokenPair> {
  const parts = parseRefreshToken(refreshToken);
  if (!parts) throw invalidRefreshToken();

  for (let attempt = 0; attempt < MAX_ROTATION_ATTEMPTS; attempt += 1) {
    const tokens = await rotate(parts);
    if (tokens) return tokens;
  }
  // Lost every race: refuse this request but leave the session alone; the winners hold valid pairs.
  throw invalidRefreshToken();
}

/** Revokes the current session only; other devices stay signed in. */
export async function logout(userId: string, sessionId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: userDtoSelect });
  if (!user) throw sessionRevoked();
  return toUserDto(user);
}

/** The session behind an access token must exist, belong to its user and be live (§5.2 step 3). */
export async function assertActiveSession({ userId, sessionId }: AccessTokenClaims): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { userId: true, expiresAt: true, revokedAt: true },
  });
  if (
    !session ||
    session.userId !== userId ||
    session.revokedAt !== null ||
    session.expiresAt <= new Date()
  ) {
    throw sessionRevoked();
  }
}
