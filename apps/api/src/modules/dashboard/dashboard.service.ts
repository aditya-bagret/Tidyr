// Dashboard (API_CONTRACT §7). Tasks are scoped through `project: { ownerId }` like the tasks
// service, and "overdue" is the same rule as `GET /tasks?due=overdue`, relative to the client's
// `today` (D-009), so the dashboard count and the list it links to always agree.
import type { Dashboard, ProjectStatus, TaskPriority } from '@tidyr/shared';
import type { Prisma } from '../../generated/prisma/client';
import { fromDateOnly } from '../../lib/dates';
import { prisma } from '../../lib/prisma';
import { taskDtoSelect, toTaskDto } from '../tasks/task.serializer';

const LIST_SIZE = 5;

export async function get(userId: string, today: string): Promise<Dashboard> {
  const todayDate = fromDateOnly(today);
  const ownTasks: Prisma.TaskWhereInput = { project: { ownerId: userId } };
  const openTasks: Prisma.TaskWhereInput = { ...ownTasks, status: { not: 'COMPLETED' } };
  const overdueWhere: Prisma.TaskWhereInput = { ...openTasks, dueDate: { lt: todayDate } };
  const upcomingWhere: Prisma.TaskWhereInput = { ...openTasks, dueDate: { gte: todayDate } };
  // Same-day ties go to the more urgent task; `id` keeps the order stable.
  const byDueDate: Prisma.TaskOrderByWithRelationInput[] = [
    { dueDate: 'asc' },
    { priority: 'desc' },
    { id: 'asc' },
  ];

  // Five independent queries, run in parallel (TECHNICAL_REQUIREMENTS §13).
  const [projectGroups, taskGroups, overdueTasks, overdue, upcoming] = await Promise.all([
    prisma.project.groupBy({
      by: ['status'],
      where: { ownerId: userId },
      _count: { _all: true },
    }),
    // One pass gives both the status counts and the priority counts.
    prisma.task.groupBy({
      by: ['status', 'priority'],
      where: ownTasks,
      _count: { _all: true },
    }),
    prisma.task.count({ where: overdueWhere }),
    prisma.task.findMany({
      where: overdueWhere,
      orderBy: byDueDate,
      take: LIST_SIZE,
      select: taskDtoSelect,
    }),
    prisma.task.findMany({
      where: upcomingWhere,
      orderBy: byDueDate,
      take: LIST_SIZE,
      select: taskDtoSelect,
    }),
  ]);

  // Every enum key is present even when its count is 0 (API_CONTRACT §7).
  const projectsByStatus: Record<ProjectStatus, number> = {
    NOT_STARTED: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
  };
  for (const group of projectGroups) projectsByStatus[group.status] += group._count._all;

  const tasksByPriority: Record<TaskPriority, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  const tasksByStatus = { PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0 };
  for (const group of taskGroups) {
    tasksByPriority[group.priority] += group._count._all;
    tasksByStatus[group.status] += group._count._all;
  }

  return {
    today,
    totalProjects:
      projectsByStatus.NOT_STARTED + projectsByStatus.IN_PROGRESS + projectsByStatus.COMPLETED,
    projectsInProgress: projectsByStatus.IN_PROGRESS,
    totalTasks: tasksByStatus.PENDING + tasksByStatus.IN_PROGRESS + tasksByStatus.COMPLETED,
    completedTasks: tasksByStatus.COMPLETED,
    // Pending means status PENDING only; in-progress tasks are counted separately (D-006).
    pendingTasks: tasksByStatus.PENDING,
    inProgressTasks: tasksByStatus.IN_PROGRESS,
    overdueTasks,
    projectsByStatus,
    tasksByPriority,
    overdue: overdue.map(toTaskDto),
    upcoming: upcoming.map(toTaskDto),
  };
}
