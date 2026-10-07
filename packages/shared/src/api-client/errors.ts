import { ERROR_CODES, type ErrorCode, type ErrorDetail } from '../types';

export interface ApiErrorOptions {
  details?: ErrorDetail[];
  /** Seconds, from the `Retry-After` header on 429. */
  retryAfter?: number;
  requestId?: string;
}

/** Every failed client call rejects with this. `status` is 0 for `NETWORK_ERROR` and `TIMEOUT`. */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: ErrorDetail[];
  readonly retryAfter?: number;
  readonly requestId?: string;

  constructor(status: number, code: ErrorCode, message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.retryAfter = options.retryAfter;
    this.requestId = options.requestId;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

function isErrorDetail(value: unknown): value is ErrorDetail {
  return isRecord(value) && typeof value.path === 'string' && typeof value.message === 'string';
}

function parseRetryAfter(header: string | null): number | undefined {
  if (header === null || header.trim() === '') return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

// Used when the body isn't our envelope, e.g. an HTML 502 from the hosting proxy.
function fallbackCode(status: number): ErrorCode {
  if (status === 404) return 'NOT_FOUND';
  if (status === 413) return 'PAYLOAD_TOO_LARGE';
  if (status === 429) return 'RATE_LIMITED';
  return 'INTERNAL_ERROR';
}

export function toApiError(status: number, payload: unknown, retryAfterHeader: string | null) {
  const retryAfter = parseRetryAfter(retryAfterHeader);
  const body = isRecord(payload) ? payload.error : undefined;

  if (isRecord(body) && isErrorCode(body.code) && typeof body.message === 'string') {
    return new ApiError(status, body.code, body.message, {
      details: Array.isArray(body.details) ? body.details.filter(isErrorDetail) : undefined,
      retryAfter,
      requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
    });
  }
  return new ApiError(status, fallbackCode(status), `Request failed with status ${status}`, {
    retryAfter,
  });
}
