import type { ErrorCode, ErrorDetail } from '@tidyr/shared';
import type { ZodError } from 'zod';

/** Codes the API can send. NETWORK_ERROR and TIMEOUT only ever come from the client. */
export type ApiErrorCode = Exclude<ErrorCode, 'NETWORK_ERROR' | 'TIMEOUT'>;

type UnauthorizedCode = Extract<
  ApiErrorCode,
  | 'UNAUTHENTICATED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'SESSION_REVOKED'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_REFRESH_TOKEN'
>;

/** An expected failure. Its status, code, message and details are safe to send to the client. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function zodIssuesToDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

export const validationError = (details: ErrorDetail[]) =>
  new AppError(400, 'VALIDATION_ERROR', 'Invalid request', details);

export const invalidJson = () => new AppError(400, 'INVALID_JSON', 'Malformed JSON body');

export const unauthorized = (code: UnauthorizedCode, message: string) =>
  new AppError(401, code, message);

export const notFound = (resource = 'Resource') =>
  new AppError(404, 'NOT_FOUND', `${resource} not found`);

export const conflict = (message: string, details?: ErrorDetail[]) =>
  new AppError(409, 'CONFLICT', message, details);

export const payloadTooLarge = () =>
  new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');

export const rateLimited = () =>
  new AppError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.');
