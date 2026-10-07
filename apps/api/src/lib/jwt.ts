import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { unauthorized } from './errors';

// Pinned on both sides: verify() never trusts the token's own `alg` header (blocks `none`/HS512).
const ALGORITHM = 'HS256';

const claimsSchema = z.object({ sub: z.uuid(), sid: z.uuid() });

export interface AccessTokenClaims {
  userId: string;
  sessionId: string;
}

export function signAccessToken({ userId, sessionId }: AccessTokenClaims): string {
  return jwt.sign({ sid: sessionId }, env.JWT_SECRET, {
    algorithm: ALGORITHM,
    subject: userId,
    expiresIn: env.JWT_ACCESS_TTL,
  });
}

/** Throws 401 TOKEN_EXPIRED or TOKEN_INVALID (API_CONTRACT §1.2). */
export function verifyAccessToken(token: string): AccessTokenClaims {
  let payload: unknown;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM] });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw unauthorized('TOKEN_EXPIRED', 'Access token expired');
    }
    throw unauthorized('TOKEN_INVALID', 'Invalid access token');
  }

  // A validly signed token without our claims is still not one we issued.
  const claims = claimsSchema.safeParse(payload);
  if (!claims.success) throw unauthorized('TOKEN_INVALID', 'Invalid access token');
  return { userId: claims.data.sub, sessionId: claims.data.sid };
}
