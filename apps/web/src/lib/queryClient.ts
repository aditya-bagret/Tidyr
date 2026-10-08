import { isApiError } from '@tidyr/shared';
import { QueryClient } from '@tanstack/react-query';

// A 4xx won't change on retry; network errors, timeouts and 5xx get one more attempt.
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        // Picks up changes made on the other platform when the user comes back to the tab.
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}
