import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { z } from 'zod';

const uuid = z.uuid();

/** Reuses a caller's UUID `X-Request-Id` so logs correlate across services; anything else is replaced. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get('x-request-id');
  const id = incoming !== undefined && uuid.safeParse(incoming).success ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};
