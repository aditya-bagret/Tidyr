import type { Project, TaskCounts } from '@tidyr/shared';
import type { Project as ProjectRow } from '../../generated/prisma/client';
import { toDateOnlyOrNull } from '../../lib/dates';

/** Columns a project DTO needs. `ownerId` and `taskSeq` never leave the API. */
export const projectDtoSelect = {
  id: true,
  key: true,
  name: true,
  description: true,
  status: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type ProjectDtoRow = Pick<ProjectRow, keyof typeof projectDtoSelect>;

export const emptyTaskCounts = (): TaskCounts => ({
  total: 0,
  pending: 0,
  inProgress: 0,
  completed: 0,
});

/** The only way a project leaves the API: an explicit allow-list, dates as `YYYY-MM-DD`. */
export function toProjectDto(project: ProjectDtoRow, taskCounts: TaskCounts): Project {
  return {
    id: project.id,
    key: project.key,
    name: project.name,
    description: project.description,
    status: project.status,
    startDate: toDateOnlyOrNull(project.startDate),
    endDate: toDateOnlyOrNull(project.endDate),
    taskCounts,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}
