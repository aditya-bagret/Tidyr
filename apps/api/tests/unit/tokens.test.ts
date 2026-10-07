import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  formatRefreshToken,
  generateTokenSecret,
  hashTokenSecret,
  parseRefreshToken,
  secretMatchesHash,
} from '../../src/lib/tokens';

describe('refresh token helpers', () => {
  it('generates 32-byte base64url secrets that never repeat', () => {
    const secrets = new Set(Array.from({ length: 100 }, generateTokenSecret));
    expect(secrets.size).toBe(100);
    for (const secret of secrets) expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('round-trips "<sessionId>.<secret>"', () => {
    const parts = { sessionId: randomUUID(), secret: generateTokenSecret() };
    expect(parseRefreshToken(formatRefreshToken(parts))).toEqual(parts);
  });

  it.each([
    '',
    'abc',
    `${randomUUID()}`,
    `${randomUUID()}.`,
    `not-a-uuid.${'a'.repeat(43)}`,
    `${randomUUID()}.${'a'.repeat(42)}`,
    `${randomUUID()}.${'a'.repeat(42)}=`,
    `${randomUUID()}.${'a'.repeat(43)}.x`,
  ])('rejects the malformed token %j', (token) => {
    expect(parseRefreshToken(token)).toBeNull();
  });

  it('stores a SHA-256 hex digest that matches only its own secret', () => {
    const secret = generateTokenSecret();
    const hash = hashTokenSecret(secret);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashTokenSecret(secret));
    expect(secretMatchesHash(secret, hash)).toBe(true);
    expect(secretMatchesHash(generateTokenSecret(), hash)).toBe(false);
  });

  it('treats a malformed stored hash as a mismatch instead of throwing', () => {
    expect(secretMatchesHash(generateTokenSecret(), 'abc')).toBe(false);
    expect(secretMatchesHash(generateTokenSecret(), '')).toBe(false);
  });
});
