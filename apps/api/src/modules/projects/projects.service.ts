// Projects (API_CONTRACT §5). Every query is scoped to the caller with `ownerId` (SCHEMA §5), so a
// project someone else owns looks exactly like one that doesn't exist: 404 (D-005).
import {
  DATE_RANGE_MESSAGE,
  isValidDateRange,
  suggestProjectKey,
  type CreateProjectInput,
  type ListProjectsQuery,
  type ListResponse,
  type Project,
  type ProjectSortField,
  type SortOrder,
  type TaskCounts,
  type TaskStatus,
  type UpdateProjectInput,
} from '@tidyr/shared';
import { Prisma } from '../../generated/prisma/client';
import { fromDateOnlyOrNull, toDateOnlyOrNull } from '../../lib/dates';
import { conflict, notFound, validationError } from '../../lib/errors';
import { toPageMeta, toSkipTake } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';
import { escapeLikePattern } from '../../lib/search';
import * as audit from '../audit/audit.service';
import {
  emptyTaskCounts,
  projectDtoSelect,
  toProjectDto,
  type ProjectDtoRow,
} from './project.serializer';
import { firstFreeKey } from './projectKey';

const AUDITED_FIELDS = ['name', 'key', 'description', 'status', 'startDate', 'endDate'] as const;

// Two concurrent creates can pick the same generated key; the unique index rejects one, which
// then retries with a fresh look at the taken keys.
const MAX_KEY_ATTEMPTS = 3;

const STATUS_COUNT_FIELD: Record<TaskStatus, Exclude<keyof TaskCounts, 'total'>> = {
  PENDING: 'pending',
  IN_PROGRESS: 'inProgress',
  COMPLETED: 'completed',
};

// `id` breaks ties so pages never overlap or skip rows that share a sort value.
const ORDER_BY: Record<
  ProjectSortField,
  (order: SortOrder) => Prisma.ProjectOrderByWithRelationInput
> = {
  createdAt: (order) => ({ createdAt: order }),
  updatedAt: (order) => ({ updatedAt: order }),
  name: (order) => ({ name: order }),
  endDate: (order) => ({ endDate: { sort: order, nulls: 'last' } }),
};

const keyTaken = () =>
  conflict('Project key already in use', [
    { path: 'key', message: 'You already have a project with this key' },
  ]);

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Task counts for the given projects with one `groupBy`, never a query per project (§13). */
async function taskCountsFor(projectIds: string[]): Promise<Map<string, TaskCounts>> {
  const counts = new Map(projectIds.map((id) => [id, emptyTaskCounts()]));
  if (projectIds.length === 0) return counts;

  const groups = await prisma.task.groupBy({
    by: ['projectId', 'status'],
    where: { projectId: { in: projectIds } },
    _count: { _all: true },
  });
  for (const group of groups) {
    const projectCounts = counts.get(group.projectId);
    if (!projectCounts) continue;
    projectCounts.total += group._count._all;
    projectCounts[STATUS_COUNT_FIELD[group.status]] += group._count._all;
  }
  return counts;
}

async function withTaskCounts(project: ProjectDtoRow): Promise<Project> {
  const counts = await taskCountsFor([project.id]);
  return toProjectDto(project, counts.get(project.id) ?? emptyTaskCounts());
}

/** The audited fields as the API shows them, so dates compare as `YYYY-MM-DD`. */
const auditView = (project: ProjectDtoRow) => toProjectDto(project, emptyTaskCounts());

async function generateKey(
  tx: Prisma.TransactionClient,
  userId: string,
  name: string,
): Promise<string> {
  const base = suggestProjectKey(name);
  const taken = await tx.project.findMany({
    where: { ownerId: userId, key: { startsWith: base } },
    select: { key: true },
  });
  return firstFreeKey(base, new Set(taken.map((project) => project.key)));
}

export async function list(
  userId: string,
  query: ListProjectsQuery,
): Promise<ListResponse<Project>> {
  const where: Prisma.ProjectWhereInput = {
    ownerId: userId,
    ...(query.search !== undefined && {
      name: { contains: escapeLikePattern(query.search), mode: 'insensitive' },
    }),
    ...(query.status !== undefined && { status: { in: query.status } }),
  };

  const [total, rows] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy: [ORDER_BY[query.sort](query.order), { id: 'asc' }],
      ...toSkipTake(query),
      select: projectDtoSelect,
    }),
  ]);

  const counts = await taskCountsFor(rows.map((row) => row.id));
  return {
    data: rows.map((row) => toProjectDto(row, counts.get(row.id) ?? emptyTaskCounts())),
    meta: toPageMeta(query, total),
  };
}

export async function get(userId: string, id: string): Promise<Project> {
  const project = await prisma.project.findFirst({
    where: { id, ownerId: userId },
    select: projectDtoSelect,
  });
  if (!project) throw notFound('Project');
  return withTaskCounts(project);
}

export async function create(userId: string, input: CreateProjectInput): Promise<Project> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const project = await prisma.$transaction(async (tx) => {
        const created = await tx.project.create({
          data: {
            ownerId: userId,
            key: input.key ?? (await generateKey(tx, userId, input.name)),
            name: input.name,
            description: input.description ?? null,
            status: input.status,
            startDate: fromDateOnlyOrNull(input.startDate),
            endDate: fromDateOnlyOrNull(input.endDate),
          },
          select: projectDtoSelect,
        });
        await audit.record(tx, {
          userId,
          projectId: created.id,
          entityType: 'PROJECT',
          entityId: created.id,
          action: 'CREATED',
          changes: null,
        });
        return created;
      });
      return toProjectDto(project, emptyTaskCounts());
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      if (input.key !== undefined) throw keyTaken();
      if (attempt >= MAX_KEY_ATTEMPTS) throw error;
    }
  }
}

export async function update(
  userId: string,
  id: string,
  input: UpdateProjectInput,
): Promise<Project> {
  try {
    const project = await prisma.$transaction(async (tx) => {
      const before = await tx.project.findFirst({
        where: { id, ownerId: userId },
        select: projectDtoSelect,
      });
      if (!before) throw notFound('Project');

      // The schema only sees the fields that were sent; the range must hold for the merged result.
      const range = {
        startDate:
          input.startDate !== undefined ? input.startDate : toDateOnlyOrNull(before.startDate),
        endDate: input.endDate !== undefined ? input.endDate : toDateOnlyOrNull(before.endDate),
      };
      if (!isValidDateRange(range)) {
        throw validationError([{ path: 'endDate', message: DATE_RANGE_MESSAGE }]);
      }

      const after = await tx.project.update({
        where: { id: before.id },
        data: {
          key: input.key,
          name: input.name,
          description: input.description,
          status: input.status,
          startDate: fromDateOnlyOrNull(input.startDate),
          endDate: fromDateOnlyOrNull(input.endDate),
        },
        select: projectDtoSelect,
      });

      // An update that changes nothing leaves no history entry.
      const changes = audit.diff(auditView(before), auditView(after), AUDITED_FIELDS);
      if (changes) {
        await audit.record(tx, {
          userId,
          projectId: after.id,
          entityType: 'PROJECT',
          entityId: after.id,
          action: 'UPDATED',
          changes,
        });
      }
      return after;
    });
    return await withTaskCounts(project);
  } catch (error) {
    if (input.key !== undefined && isUniqueViolation(error)) throw keyTaken();
    throw error;
  }
}

/** Deletes the project; its tasks go with it (DB cascade). The audit row outlives both. */
export async function remove(userId: string, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id, ownerId: userId },
      select: { id: true },
    });
    if (!project) throw notFound('Project');

    // Written first: the row needs the project to exist for its FK, which then becomes NULL.
    await audit.record(tx, {
      userId,
      projectId: project.id,
      entityType: 'PROJECT',
      entityId: project.id,
      action: 'DELETED',
      changes: null,
    });
    await tx.project.delete({ where: { id: project.id } });
  });
}
