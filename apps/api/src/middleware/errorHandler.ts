import type { ErrorBody } from '@tidyr/shared';
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { Prisma } from '../generated/prisma/client';
import {
  AppError,
  conflict,
  invalidJson,
  notFound,
  payloadTooLarge,
  validationError,
  zodIssuesToDetails,
} from '../lib/errors';

/** The shape of errors thrown by express.json() (body-parser + http-errors). */
interface BodyParserError {
  type: string;
  status: number;
}

function isBodyParserError(err: unknown): err is BodyParserError {
  return (
    err instanceof Error &&
    'type' in err &&
    typeof err.type === 'string' &&
    'status' in err &&
    typeof err.status === 'number'
  );
}

/** Maps every known failure to an AppError. Returns null for anything unexpected. */
function toAppError(err: unknown): AppError | null {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return validationError(zodIssuesToDetails(err));

  if (isBodyParserError(err) && err.status >= 400 && err.status < 500) {
    if (err.type === 'entity.too.large') return payloadTooLarge();
    // entity.parse.failed, plus unreadable bodies (unsupported charset or encoding): all mean
    // the client sent a body we can't parse, so they share INVALID_JSON instead of becoming 500s.
    return invalidJson();
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return conflict('A record with these values already exists');
    if (err.code === 'P2025') return notFound();
  }

  return null;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // Express's default handler closes the connection when a response is already under way.
  if (res.headersSent) {
    next(err);
    return;
  }

  const appError = toAppError(err);
  if (appError) {
    const body: ErrorBody = {
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details && { details: appError.details }),
      },
    };
    res.status(appError.status).json(body);
    return;
  }

  // Unknown failures are logged in full but reach the client only as a generic message (SEC-08).
  logger.error({ err, requestId: req.requestId }, 'request.unhandled_error');
  const body: ErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', requestId: req.requestId },
  };
  res.status(500).json(body);
};
