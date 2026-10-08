import { isApiError } from '@tidyr/shared';
import { errorMessage, rateLimitMessage } from '@/lib/errors';

export interface FormAlert {
  tone: 'error' | 'warning';
  message: string;
}

/** The banner for a failed login/register that isn't tied to one field (APP_FLOW F1, F2). */
export function formAlertFor(error: unknown): FormAlert {
  if (isApiError(error) && error.code === 'RATE_LIMITED') {
    return { tone: 'warning', message: rateLimitMessage(error.retryAfter) };
  }
  return { tone: 'error', message: errorMessage(error) };
}
