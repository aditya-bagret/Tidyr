import type { Request, RequestHandler } from 'express';
import { unauthorized } from '../lib/errors';
import { verifyAccessToken } from '../lib/jwt';
import { assertActiveSession } from '../modules/auth/auth.service';

const BEARER = /^Bearer (\S+)$/i;

/**
 * TECHNICAL_REQUIREMENTS §5.2: a distinct 401 code for each failure, because clients react
 * differently (refresh on TOKEN_EXPIRED / SESSION_REVOKED, sign out on the rest).
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = BEARER.exec(req.headers.authorization ?? '')?.[1];
  if (!token) throw unauthorized('UNAUTHENTICATED', 'Authentication required');

  const claims = verifyAccessToken(token);
  await assertActiveSession(claims);
  req.user = { id: claims.userId, sessionId: claims.sessionId };
  next();
};

/** The caller set by `authenticate`. Only handlers mounted behind it may call this. */
export function currentUser(req: Request): NonNullable<Request['user']> {
  if (!req.user) throw new Error('authenticate middleware did not run');
  return req.user;
}
