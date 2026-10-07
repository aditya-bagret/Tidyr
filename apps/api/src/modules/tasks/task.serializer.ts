import type { Task } from '@tidyr/shared';
import type { Prisma } from '../../generated/prisma/client';
import { toDateOnlyOrNull } from '../../lib/dates';
import { formatTaskKey } from './taskKey';

/** Columns a task DTO needs, plus the project summary the key and clients use. */
export const taskDtoSelect = {
  id: true,
  number: true,
  projectId: true,
  name: true,
  description: true,
  priority: true,
  status: true,
  dueDate: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, key: true, name: true } },
} as const satisfies Prisma.TaskSelect;

export type TaskDtoRow = Prisma.TaskGetPayload<{ select: typeof taskDtoSelect }>;

/** The only way a task leaves the API: an explicit allow-list, dates as `YYYY-MM-DD`. */
export function toTaskDto(task: TaskDtoRow): Task {
  return {
    id: task.id,
    key: formatTaskKey(task.project.key, task.number),
    number: task.number,
    projectId: task.projectId,
    project: { id: task.project.id, key: task.project.key, name: task.project.name },
    name: task.name,
    description: task.description,
    priority: task.priority,
    status: task.status,
    dueDate: toDateOnlyOrNull(task.dueDate),
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
