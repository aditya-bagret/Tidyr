// Limiters are built by factories so every createApp() call (one per test file) starts with an
// empty in-memory store. Limits come from env so tests can use small, known values (SEC-06).
import type { Request } from 'express';
import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';
import { env } from '../config/env';
import { rateLimited } from '../lib/errors';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const REFRESH_LIMIT = 60;

function createLimiter(options: Partial<Options>) {
  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Retry-After is already set at this point; the error handler sends the standard envelope.
    handler: (_req, _res, next) => next(rateLimited()),
    ...options,
  });
}

function bodyEmail(req: Request): string {
  const body: unknown = req.body;
  if (
    typeof body === 'object' &&
    body !== null &&
    'email' in body &&
    typeof body.email === 'string'
  ) {
    return body.email.trim().toLowerCase();
  }
  return '';
}

export const createApiLimiter = () =>
  createLimiter({ windowMs: FIFTEEN_MINUTES, limit: env.RATE_LIMIT_API_MAX });

/** Failed logins per IP + email, so testing the limit can't lock out other accounts (D-015). */
export const createLoginLimiter = () =>
  createLimiter({
    windowMs: FIFTEEN_MINUTES,
    limit: env.RATE_LIMIT_AUTH_MAX,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}|${bodyEmail(req)}`,
  });

export const createRegisterLimiter = () =>
  createLimiter({ windowMs: ONE_HOUR, limit: env.RATE_LIMIT_REGISTER_MAX });

export const createRefreshLimiter = () =>
  createLimiter({ windowMs: FIFTEEN_MINUTES, limit: REFRESH_LIMIT });
