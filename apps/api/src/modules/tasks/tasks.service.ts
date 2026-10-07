// Tasks (API_CONTRACT §6). Tasks have no owner column: a task is the caller's when its project is,
// so every query filters on `project: { ownerId }` (SCHEMA §5) and anything else is a 404 (D-005).
import {
  addDays,
  type CreateTaskInput,
  type ListResponse,
  type ListTasksQuery,
  type SortOrder,
  type Task,
  type TaskDueFilter,
  type TaskSortField,
  type TaskStatus,
  type UpdateTaskInput,
} from '@tidyr/shared';
import type { Prisma } from '../../generated/prisma/client';
import { fromDateOnly, fromDateOnlyOrNull } from '../../lib/dates';
import { notFound } from '../../lib/errors';
import { toPageMeta, toSkipTake } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';
import { escapeLikePattern } from '../../lib/search';
import * as audit from '../audit/audit.service';
import { taskDtoSelect, toTaskDto, type TaskDtoRow } from './task.serializer';
import { parseTaskKey } from './taskKey';

const AUDITED_FIELDS = ['name', 'description', 'priority', 'status', 'dueDate'] as const;

// `id` breaks ties so pages never overlap or skip rows that share a sort value.
const ORDER_BY: Record<TaskSortField, (order: SortOrder) => Prisma.TaskOrderByWithRelationInput> = {
  createdAt: (order) => ({ createdAt: order }),
  updatedAt: (order) => ({ updatedAt: order }),
  name: (order) => ({ name: order }),
  // `task_priority` is a Postgres enum, which sorts in declaration order: LOW < MEDIUM < HIGH.
  priority: (order) => ({ priority: order }),
  dueDate: (order) => ({ dueDate: { sort: order, nulls: 'last' } }),
};

/** Name contains the text; text shaped like a key (`web-2`) also matches that task's key. */
function searchFilter(search: string): Prisma.TaskWhereInput {
  const byName: Prisma.TaskWhereInput = {
    name: { contains: escapeLikePattern(search), mode: 'insensitive' },
  };
  const key = parseTaskKey(search);
  if (!key) return byName;
  return { OR: [byName, { number: key.number, project: { key: key.projectKey } }] };
}

/** Due-date windows relative to the client's `today` (D-009). */
function dueFilter(due: TaskDueFilter, today: string): Prisma.TaskWhereInput {
  const todayDate = fromDateOnly(today);
  switch (due) {
    case 'overdue':
      return { dueDate: { lt: todayDate }, status: { not: 'COMPLETED' } };
    case 'today':
      return { dueDate: todayDate };
    case 'week':
      return { dueDate: { gte: todayDate, lte: fromDateOnly(addDays(today, 6)) } };
    case 'none':
      return { dueDate: null };
  }
}

/**
 * The `completedAt` write for a status change: set when a task becomes COMPLETED (kept if it already
 * was), cleared when it leaves COMPLETED, untouched when the status isn't sent.
 */
function completedAtFor(
  status: TaskStatus | undefined,
  current: Date | null,
): Date | null | undefined {
  if (status === undefined) return undefined;
  if (status !== 'COMPLETED') return null;
  return current ?? new Date();
}

/** The audited fields as the API shows them, so dates compare as `YYYY-MM-DD`. */
const auditView = (task: TaskDtoRow) => toTaskDto(task);

export async function list(userId: string, query: ListTasksQuery): Promise<ListResponse<Task>> {
  // Separate AND clauses, so the status filter and `due=overdue` (which also checks status) combine.
  const filters: Prisma.TaskWhereInput[] = [{ project: { ownerId: userId } }];
  if (query.projectId !== undefined) filters.push({ projectId: query.projectId });
  if (query.search !== undefined) filters.push(searchFilter(query.search));
  if (query.status !== undefined) filters.push({ status: { in: query.status } });
  if (query.priority !== undefined) filters.push({ priority: { in: query.priority } });
  if (query.due !== undefined) filters.push(dueFilter(query.due, query.today));
  const where: Prisma.TaskWhereInput = { AND: filters };

  const [total, rows] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      orderBy: [ORDER_BY[query.sort](query.order), { id: 'asc' }],
      ...toSkipTake(query),
      select: taskDtoSelect,
    }),
  ]);

  return { data: rows.map(toTaskDto), meta: toPageMeta(query, total) };
}

export async function get(userId: string, id: string): Promise<Task> {
  const task = await prisma.task.findFirst({
    where: { id, project: { ownerId: userId } },
    select: taskDtoSelect,
  });
  if (!task) throw notFound('Task');
  return toTaskDto(task);
}

export async function create(userId: string, input: CreateTaskInput): Promise<Task> {
  const task = await prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: input.projectId, ownerId: userId },
      select: { id: true },
    });
    if (!project) throw notFound('Project');

    // UPDATE … SET task_seq = task_seq + 1 RETURNING: the row lock it takes serializes concurrent
    // creates in one project, so each gets the next number (SCHEMA §4.5).
    const { taskSeq } = await tx.project.update({
      where: { id: project.id },
      data: { taskSeq: { increment: 1 } },
      select: { taskSeq: true },
    });

    const created = await tx.task.create({
      data: {
        projectId: project.id,
        number: taskSeq,
        name: input.name,
        description: input.description ?? null,
        priority: input.priority,
        status: input.status,
        dueDate: fromDateOnlyOrNull(input.dueDate),
        completedAt: completedAtFor(input.status, null),
      },
      select: taskDtoSelect,
    });
    await audit.record(tx, {
      userId,
      projectId: project.id,
      entityType: 'TASK',
      entityId: created.id,
      action: 'CREATED',
      changes: null,
    });
    return created;
  });
  return toTaskDto(task);
}

/** Partial update (D-007). `projectId` never reaches here: the schema strips it (D-008). */
export async function update(userId: string, id: string, input: UpdateTaskInput): Promise<Task> {
  const task = await prisma.$transaction(async (tx) => {
    const before = await tx.task.findFirst({
      where: { id, project: { ownerId: userId } },
      select: taskDtoSelect,
    });
    if (!before) throw notFound('Task');

    const after = await tx.task.update({
      where: { id: before.id },
      data: {
        name: input.name,
        description: input.description,
        priority: input.priority,
        status: input.status,
        dueDate: fromDateOnlyOrNull(input.dueDate),
        completedAt: completedAtFor(input.status, before.completedAt),
      },
      select: taskDtoSelect,
    });

    // An update that changes nothing leaves no history entry (D-032).
    const changes = audit.diff(auditView(before), auditView(after), AUDITED_FIELDS);
    if (changes) {
      await audit.record(tx, {
        userId,
        projectId: after.projectId,
        entityType: 'TASK',
        entityId: after.id,
        action: 'UPDATED',
        changes,
      });
    }
    return after;
  });
  return toTaskDto(task);
}

export async function remove(userId: string, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const task = await tx.task.findFirst({
      where: { id, project: { ownerId: userId } },
      select: { id: true, projectId: true },
    });
    if (!task) throw notFound('Task');

    await audit.record(tx, {
      userId,
      projectId: task.projectId,
      entityType: 'TASK',
      entityId: task.id,
      action: 'DELETED',
      changes: null,
    });
    await tx.task.delete({ where: { id: task.id } });
  });
}
