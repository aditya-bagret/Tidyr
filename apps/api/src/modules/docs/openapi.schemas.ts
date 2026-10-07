// Response schemas for the OpenAPI document only; nothing validates responses with them. The
// response types live in @tidyr/shared as interfaces, so each schema `satisfies` its shared type:
// a field the type adds, drops or retypes fails the typecheck instead of drifting out of the docs.
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES,
  ERROR_CODES,
  PROJECT_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type ActivityEntry,
  type AuthResult,
  type Dashboard,
  type ErrorBody,
  type HealthStatus,
  type PageMeta,
  type Project,
  type Task,
  type TokenPair,
  type User,
} from '@tidyr/shared';
import { z } from 'zod';
import 'zod-openapi';

const timestamp = z.iso.datetime().meta({ example: '2026-10-07T09:30:00.000Z' });
const dateOnly = z.string().meta({ format: 'date', example: '2026-10-20' });
const nullableDate = dateOnly.nullable();

export const userSchema = z
  .object({
    id: z.uuid(),
    fullName: z.string().meta({ example: 'Demo User' }),
    email: z.email().meta({ example: 'demo@tidyr.test' }),
    createdAt: timestamp,
  })
  .meta({ id: 'User' }) satisfies z.ZodType<User>;

export const tokenPairSchema = z
  .object({
    accessToken: z.string().meta({ description: 'JWT (HS256), valid for 15 minutes' }),
    refreshToken: z
      .string()
      .meta({ description: '`<sessionId>.<secret>`, rotated on every refresh' }),
  })
  .meta({ id: 'TokenPair' }) satisfies z.ZodType<TokenPair>;

export const authResultSchema = tokenPairSchema
  .extend({ user: userSchema })
  .meta({ id: 'AuthResult' }) satisfies z.ZodType<AuthResult>;

export const projectSchema = z
  .object({
    id: z.uuid(),
    key: z.string().meta({ example: 'WEB' }),
    name: z.string().meta({ example: 'Website Redesign' }),
    description: z.string().nullable(),
    status: z.enum(PROJECT_STATUSES),
    startDate: nullableDate,
    endDate: nullableDate,
    taskCounts: z.object({
      total: z.int(),
      pending: z.int(),
      inProgress: z.int(),
      completed: z.int(),
    }),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .meta({ id: 'Project' }) satisfies z.ZodType<Project>;

export const taskSchema = z
  .object({
    id: z.uuid(),
    key: z.string().meta({ example: 'WEB-12', description: 'Project key + "-" + number' }),
    number: z.int().meta({ example: 12 }),
    projectId: z.uuid(),
    project: z.object({ id: z.uuid(), key: z.string(), name: z.string() }),
    name: z.string().meta({ example: 'Design hero section' }),
    description: z.string().nullable(),
    priority: z.enum(TASK_PRIORITIES),
    status: z.enum(TASK_STATUSES),
    dueDate: nullableDate,
    completedAt: timestamp.nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .meta({ id: 'Task' }) satisfies z.ZodType<Task>;

export const dashboardSchema = z
  .object({
    today: dateOnly,
    totalProjects: z.int(),
    projectsInProgress: z.int(),
    totalTasks: z.int(),
    completedTasks: z.int(),
    pendingTasks: z.int().meta({ description: 'Status PENDING only (D-006)' }),
    inProgressTasks: z.int(),
    overdueTasks: z.int(),
    projectsByStatus: z.object({ NOT_STARTED: z.int(), IN_PROGRESS: z.int(), COMPLETED: z.int() }),
    tasksByPriority: z.object({ LOW: z.int(), MEDIUM: z.int(), HIGH: z.int() }),
    overdue: z.array(taskSchema).meta({
      description: 'Up to 5 non-completed tasks due before `today`, oldest due first',
    }),
    upcoming: z.array(taskSchema).meta({
      description: 'Up to 5 non-completed tasks due on or after `today`, soonest first',
    }),
  })
  .meta({ id: 'Dashboard' }) satisfies z.ZodType<Dashboard>;

export const activityEntrySchema = z
  .object({
    id: z.uuid(),
    entityType: z.enum(ACTIVITY_ENTITY_TYPES),
    entityId: z.uuid(),
    action: z.enum(ACTIVITY_ACTIONS),
    changes: z
      .record(z.string(), z.object({ from: z.unknown(), to: z.unknown() }))
      .nullable()
      .meta({
        description: 'Only the changed fields; `null` for CREATED and DELETED',
        example: { status: { from: 'PENDING', to: 'COMPLETED' } },
      }),
    createdAt: timestamp,
  })
  .meta({ id: 'ActivityEntry' }) satisfies z.ZodType<ActivityEntry>;

export const pageMetaSchema = z
  .object({ page: z.int(), limit: z.int(), total: z.int(), totalPages: z.int() })
  .meta({ id: 'PageMeta' }) satisfies z.ZodType<PageMeta>;

export const healthSchema = z
  .object({ status: z.literal('ok'), uptime: z.number() })
  .meta({ id: 'Health' }) satisfies z.ZodType<HealthStatus>;

export const errorBodySchema = z
  .object({
    error: z.object({
      // NETWORK_ERROR and TIMEOUT are set by the client, never sent by the API.
      code: z.enum(ERROR_CODES).exclude(['NETWORK_ERROR', 'TIMEOUT']),
      message: z.string(),
      details: z
        .array(z.object({ path: z.string(), message: z.string() }))
        .optional()
        .meta({ description: 'Field errors; `path` matches the request field' }),
      requestId: z.string().optional().meta({ description: 'Present on 500 responses' }),
    }),
  })
  .meta({ id: 'Error' }) satisfies z.ZodType<ErrorBody>;

export const dataOf = <T extends z.ZodType>(schema: T) => z.object({ data: schema });
export const listOf = <T extends z.ZodType>(schema: T) =>
  z.object({ data: z.array(schema), meta: pageMetaSchema });
