import type { ActivityEntityType, ListProjectsParams, ListTasksParams } from '@tidyr/shared';

/** TECHNICAL_REQUIREMENTS §9. Prefix keys (`all`) are what mutations invalidate. */
export const queryKeys = {
  me: ['me'] as const,
  dashboard: {
    all: ['dashboard'] as const,
    byDay: (today: string) => ['dashboard', today] as const,
  },
  projects: {
    all: ['projects'] as const,
    list: (params: ListProjectsParams) => ['projects', params] as const,
  },
  project: (id: string) => ['project', id] as const,
  tasks: {
    all: ['tasks'] as const,
    list: (params: ListTasksParams) => ['tasks', params] as const,
  },
  task: (id: string) => ['task', id] as const,
  activity: (entity: ActivityEntityType, id: string) => ['activity', entity, id] as const,
};
