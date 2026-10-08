import { isApiError } from '@tidyr/shared';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

// DESIGN §5 microcopy.
export const MESSAGES = {
  network: "Can't reach the server. Check your connection and try again.",
  offline: 'You appear to be offline.',
  generic: 'Something went wrong. Please try again.',
  invalidLogin: 'Invalid email or password.',
  emailTaken: 'An account with this email already exists.',
  sessionExpired: 'Your session expired. Please log in again.',
  signedOut: "You've been signed out. Please log in again.",
} as const;

export function rateLimitMessage(retryAfterSeconds: number | undefined): string {
  const minutes = Math.max(1, Math.ceil((retryAfterSeconds ?? 60) / 60));
  return `Too many attempts. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`;
}

export function isNetworkError(error: unknown): boolean {
  return isApiError(error) && (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT');
}

/** A message that's safe to show for any failed call; server messages are only shown for 4xx. */
export function errorMessage(error: unknown): string {
  if (!isApiError(error)) return MESSAGES.generic;
  if (isNetworkError(error)) {
    return typeof navigator !== 'undefined' && !navigator.onLine
      ? MESSAGES.offline
      : MESSAGES.network;
  }
  if (error.code === 'RATE_LIMITED') return rateLimitMessage(error.retryAfter);
  if (error.status >= 400 && error.status < 500) return error.message;
  return MESSAGES.generic;
}

/**
 * Maps `VALIDATION_ERROR` (and 409 field clashes) `details[].path` onto form fields. Returns false
 * when nothing matched a field, so the caller can fall back to a banner or toast.
 */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  if (!isApiError(error) || !error.details) return false;
  let first = true;
  for (const detail of error.details) {
    const field = fields.find((name) => name === detail.path);
    if (!field) continue;
    setError(field, { type: 'server', message: detail.message }, { shouldFocus: first });
    first = false;
  }
  return !first;
}
