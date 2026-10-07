import type { RequestHandler } from 'express';
import { notFound as notFoundError } from '../lib/errors';

export const notFound: RequestHandler = (_req, _res, next) => {
  next(notFoundError('Route'));
};
