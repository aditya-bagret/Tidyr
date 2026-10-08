import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

// TECHNICAL_REQUIREMENTS §9 invalidation map.

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

/**
 * Task create or update: `tasks`, `task(id)`, `project(projectId)` (its counts), `projects`,
 * `dashboard`, plus the task's and project's activity feeds (BON-08).
 */
export function invalidateAfterTaskSave(
  queryClient: QueryClient,
  task: { id: string; projectId: string },
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.task(task.id) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.project(task.projectId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.activity('TASK', task.id) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.activity('PROJECT', task.projectId) }),
  ]);
}

/** Task delete: the same, but the deleted task's own queries are only marked stale. */
export function invalidateAfterTaskDelete(
  queryClient: QueryClient,
  task: { id: string; projectId: string },
) {
  return Promise.all([
    // Not refetched: the drawer showing them is closing, and a refetch would only 404.
    queryClient.invalidateQueries({ queryKey: queryKeys.task(task.id), refetchType: 'none' }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.activity('TASK', task.id),
      refetchType: 'none',
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.project(task.projectId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.activity('PROJECT', task.projectId) }),
  ]);
}
