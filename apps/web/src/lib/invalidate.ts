import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

// TECHNICAL_REQUIREMENTS §9 invalidation map. Task mutations join it with the task UI (Phase 10).

/** Project create or update: `projects`, `project(id)`, `dashboard`. */
export function invalidateAfterProjectSave(queryClient: QueryClient, projectId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
  ]);
}

/** Project delete: the same, plus `tasks` (its tasks are gone too). */
export function invalidateAfterProjectDelete(queryClient: QueryClient, projectId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
    // Marked stale but not refetched: the page showing it is navigating away, and a refetch
    // would only 404. Coming back to the URL refetches and shows "doesn't exist".
    queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId), refetchType: 'none' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
  ]);
}
