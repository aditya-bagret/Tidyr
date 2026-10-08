import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/env';

const valid = {
  DATABASE_URL: 'postgresql://tidyr:tidyr@localhost:5432/tidyr',
  JWT_SECRET: 'a'.repeat(32),
  WEB_ORIGINS: 'http://localhost:3000, https://tidyr.vercel.app',
};

describe('parseEnv', () => {
  it('applies the defaults from TECHNICAL_REQUIREMENTS §11 and splits WEB_ORIGINS', () => {
    expect(parseEnv(valid)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      JWT_ACCESS_TTL: 900,
      REFRESH_TOKEN_TTL_DAYS: 30,
      REFRESH_REUSE_GRACE_SECONDS: 30,
      BCRYPT_ROUNDS: 12,
      LOG_LEVEL: 'info',
      RATE_LIMIT_AUTH_MAX: 10,
      RATE_LIMIT_REGISTER_MAX: 10,
      RATE_LIMIT_API_MAX: 300,
      TRUST_PROXY_HOPS: 0,
      WEB_ORIGINS: ['http://localhost:3000', 'https://tidyr.vercel.app'],
    });
  });

  it('coerces numbers', () => {
    expect(parseEnv({ ...valid, PORT: '8080', BCRYPT_ROUNDS: '4' })).toMatchObject({
      PORT: 8080,
      BCRYPT_ROUNDS: 4,
    });
  });

  it('rejects a JWT_SECRET shorter than 32 characters without echoing it', () => {
    const secret = 'short-secret-value';
    let message = '';
    try {
      parseEnv({ ...valid, JWT_SECRET: secret });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('JWT_SECRET');
    expect(message).not.toContain(secret);
  });

  it.each(['DATABASE_URL', 'JWT_SECRET', 'WEB_ORIGINS'] as const)('requires %s', (name) => {
    const { [name]: _omitted, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrow(name);
  });

  it('parses JWT_ACCESS_TTL into seconds and rejects other formats', () => {
    expect(parseEnv({ ...valid, JWT_ACCESS_TTL: '45s' }).JWT_ACCESS_TTL).toBe(45);
    expect(parseEnv({ ...valid, JWT_ACCESS_TTL: '2h' }).JWT_ACCESS_TTL).toBe(7200);
    expect(parseEnv({ ...valid, JWT_ACCESS_TTL: '1d' }).JWT_ACCESS_TTL).toBe(86_400);
    for (const bad of ['15', '15 minutes', '0m', '-1m', '1.5h', '']) {
      expect(() => parseEnv({ ...valid, JWT_ACCESS_TTL: bad })).toThrow('JWT_ACCESS_TTL');
    }
  });

  it('accepts a proxy hop count and rejects a negative or fractional one', () => {
    expect(parseEnv({ ...valid, TRUST_PROXY_HOPS: '3' }).TRUST_PROXY_HOPS).toBe(3);
    for (const bad of ['-1', '1.5', 'true']) {
      expect(() => parseEnv({ ...valid, TRUST_PROXY_HOPS: bad })).toThrow('TRUST_PROXY_HOPS');
    }
  });

  it('rejects a non-Postgres DATABASE_URL and an invalid origin', () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: 'mysql://x@localhost/db' })).toThrow(
      'DATABASE_URL',
    );
    expect(() => parseEnv({ ...valid, WEB_ORIGINS: 'not a url' })).toThrow('WEB_ORIGINS');
  });
});
