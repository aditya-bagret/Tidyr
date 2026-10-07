// Opaque refresh tokens: "<sessionId>.<secret>" (TECHNICAL_REQUIREMENTS §5.1). The secret is 32
// random bytes, so SHA-256 is enough to store it; bcrypt's slowness only matters for human passwords.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const SECRET_BYTES = 32;
// 32 bytes → 43 base64url characters (no padding).
const SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const sessionIdSchema = z.uuid();

export interface RefreshTokenParts {
  sessionId: string;
  secret: string;
}

export function generateTokenSecret(): string {
  return randomBytes(SECRET_BYTES).toString('base64url');
}

export function formatRefreshToken({ sessionId, secret }: RefreshTokenParts): string {
  return `${sessionId}.${secret}`;
}

/** Returns null for anything that isn't a well-formed token, so it never reaches a uuid column. */
export function parseRefreshToken(token: string): RefreshTokenParts | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [sessionId = '', secret = ''] = parts;
  if (!sessionIdSchema.safeParse(sessionId).success || !SECRET_PATTERN.test(secret)) return null;
  return { sessionId, secret };
}

/** SHA-256 hex digest, as stored in `sessions.refresh_token_hash`. */
export function hashTokenSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/** Constant-time check of a presented secret against a stored hash. */
export function secretMatchesHash(secret: string, storedHash: string): boolean {
  const presented = Buffer.from(hashTokenSecret(secret), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return presented.length === stored.length && timingSafeEqual(presented, stored);
}
