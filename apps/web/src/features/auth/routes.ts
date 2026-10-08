import type { SessionExpiredReason } from '@tidyr/shared';

export const HOME_PATH = '/dashboard';

/** `/login?reason=expired|invalid` makes Login show why the user was signed out (APP_FLOW §3.2). */
export function loginPath(reason: SessionExpiredReason | null = null): string {
  return reason ? `/login?reason=${reason}` : '/login';
}
