// OpenAPI 3.1 description of API_CONTRACT, served at /api/docs (DOC-03). Request schemas are the
// same @tidyr/shared Zod schemas the routes validate with, so the docs can't disagree with the API.
import {
  activityQuerySchema,
  createProjectSchema,
  createTaskSchema,
  dashboardQuerySchema,
  idParamSchema,
  listProjectsQuerySchema,
  listTasksQuerySchema,
  loginSchema,
  PROJECT_STATUSES,
  refreshSchema,
  registerSchema,
  TASK_PRIORITIES,
  TASK_STATUSES,
  updateProjectSchema,
  updateTaskSchema,
} from '@tidyr/shared';
import type { z } from 'zod';
import {
  createDocument,
  type ZodOpenApiOperationObject,
  type ZodOpenApiResponsesObject,
} from 'zod-openapi';
import {
  activityEntrySchema,
  authResultSchema,
  dashboardSchema,
  dataOf,
  errorBodySchema,
  healthSchema,
  listOf,
  projectSchema,
  taskSchema,
  tokenPairSchema,
  userSchema,
} from './openapi.schemas';

const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });

const csv = (values: readonly string[]) => ({
  description: `Comma-separated list of ${values.join(', ')}`,
  example: values.slice(0, 2).join(','),
});
const TODAY_PARAM = {
  description: "The client's local date (YYYY-MM-DD); defaults to the server's UTC date (D-009)",
};

const listProjectsQuery = listProjectsQuerySchema.extend({
  search: listProjectsQuerySchema.shape.search.meta({
    description: 'Case-insensitive "contains" on the name',
  }),
  status: listProjectsQuerySchema.shape.status.meta(csv(PROJECT_STATUSES)),
});

const listTasksQuery = listTasksQuerySchema.extend({
  search: listTasksQuerySchema.shape.search.meta({
    description: 'Name contains the text; a key such as `web-12` also matches that task',
  }),
  status: listTasksQuerySchema.shape.status.meta(csv(TASK_STATUSES)),
  priority: listTasksQuerySchema.shape.priority.meta(csv(TASK_PRIORITIES)),
  due: listTasksQuerySchema.shape.due.meta({
    description: 'Relative to `today`. `overdue` excludes completed tasks; `week` is today…today+6',
  }),
  today: listTasksQuerySchema.shape.today.meta(TODAY_PARAM),
  sort: listTasksQuerySchema.shape.sort.meta({
    description:
      '`priority` sorts LOW < MEDIUM < HIGH; `dueDate` puts empty dates last; `urgency` lists open tasks by due date (overdue first, no date last), then completed ones, most recent first, and ignores `order`',
  }),
});

const dashboardQuery = dashboardQuerySchema.extend({
  today: dashboardQuerySchema.shape.today.meta(TODAY_PARAM),
});

const ERROR_DESCRIPTIONS = {
  400: 'VALIDATION_ERROR (with `details`) or INVALID_JSON',
  401: 'UNAUTHENTICATED, TOKEN_EXPIRED, TOKEN_INVALID or SESSION_REVOKED',
  404: 'NOT_FOUND: missing, or owned by another user',
  409: 'CONFLICT or EMAIL_TAKEN (with `details`)',
  429: 'RATE_LIMITED; `Retry-After` gives the seconds to wait',
} as const;

function errors(...statuses: Array<keyof typeof ERROR_DESCRIPTIONS>): ZodOpenApiResponsesObject {
  return Object.fromEntries(
    statuses.map((status) => [
      String(status),
      { description: ERROR_DESCRIPTIONS[status], ...json(errorBodySchema) },
    ]),
  );
}

const ok = (description: string, schema: z.ZodType) => ({ description, ...json(schema) });
const noContent = { '204': { description: 'No content' } };

const bearer = [{ bearerAuth: [] }];
const idPath = { path: idParamSchema };

/** One authenticated operation: bearer auth plus the 401 every protected route can return. */
function secured(
  tag: string,
  summary: string,
  operation: Omit<ZodOpenApiOperationObject, 'tags' | 'summary' | 'security'>,
): ZodOpenApiOperationObject {
  return {
    tags: [tag],
    summary,
    security: bearer,
    ...operation,
    responses: { ...operation.responses, ...errors(401) },
  };
}

function activityOperation(tag: string, summary: string): ZodOpenApiOperationObject {
  return secured(tag, summary, {
    requestParams: { ...idPath, query: activityQuerySchema },
    responses: {
      '200': ok('Entries, newest first', listOf(activityEntrySchema)),
      ...errors(400, 404),
    },
  });
}

/** Built per request so the `today` defaults show the current date. */
export function buildOpenApiDocument() {
  return createDocument({
    openapi: '3.1.0',
    info: {
      title: 'Tidyr API',
      version: '1.0.0',
      description:
        'One REST API for the Tidyr web and Android apps. Dates are `YYYY-MM-DD`, timestamps ' +
        'ISO-8601 UTC, ids UUIDs. `PUT` takes a partial body. Another user’s resource is a 404. ' +
        'Full contract: docs/API.md.',
    },
    servers: [{ url: '/api' }],
    tags: [
      { name: 'Health' },
      { name: 'Auth' },
      { name: 'Projects' },
      { name: 'Tasks' },
      { name: 'Dashboard' },
    ],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    },
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Liveness check (no auth, no database)',
          responses: { '200': ok('Up', dataOf(healthSchema)) },
        },
      },
      '/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Create an account and a session (10 per hour per IP)',
          requestBody: json(registerSchema),
          responses: {
            '201': ok('Registered', dataOf(authResultSchema)),
            ...errors(400, 409, 429),
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Log in (10 failed attempts per 15 min per IP + email)',
          requestBody: json(loginSchema),
          responses: {
            '200': ok('Logged in', dataOf(authResultSchema)),
            '401': {
              description: 'INVALID_CREDENTIALS (same for an unknown email or a wrong password)',
              ...json(errorBodySchema),
            },
            ...errors(400, 429),
          },
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Rotate the refresh token (60 per 15 min per IP)',
          description:
            'The old refresh token stops working. Replaying it within 30 s is treated as a retry; ' +
            'after that it counts as reuse and revokes the session.',
          requestBody: json(refreshSchema),
          responses: {
            '200': ok('New token pair', dataOf(tokenPairSchema)),
            '401': { description: 'INVALID_REFRESH_TOKEN', ...json(errorBodySchema) },
            ...errors(400, 429),
          },
        },
      },
      '/auth/logout': {
        post: secured('Auth', 'Revoke the current session', { responses: noContent }),
      },
      '/auth/me': {
        get: secured('Auth', 'The current user', {
          responses: { '200': ok('The user', dataOf(userSchema)) },
        }),
      },
      '/projects': {
        get: secured('Projects', "List the caller's projects", {
          requestParams: { query: listProjectsQuery },
          responses: { '200': ok('A page of projects', listOf(projectSchema)), ...errors(400) },
        }),
        post: secured('Projects', 'Create a project', {
          description: 'Only `name` is required. A missing `key` is generated from the name.',
          requestBody: json(createProjectSchema),
          responses: { '201': ok('Created', dataOf(projectSchema)), ...errors(400, 409) },
        }),
      },
      '/projects/{id}': {
        get: secured('Projects', 'Get a project', {
          requestParams: idPath,
          responses: { '200': ok('The project', dataOf(projectSchema)), ...errors(400, 404) },
        }),
        put: secured('Projects', 'Update a project (partial body)', {
          requestParams: idPath,
          requestBody: json(updateProjectSchema),
          responses: { '200': ok('Updated', dataOf(projectSchema)), ...errors(400, 404, 409) },
        }),
        delete: secured('Projects', 'Delete a project and all its tasks', {
          requestParams: idPath,
          responses: { ...noContent, ...errors(400, 404) },
        }),
      },
      '/projects/{id}/activity': {
        get: activityOperation('Projects', 'History of the project and its tasks'),
      },
      '/tasks': {
        get: secured('Tasks', "List the caller's tasks", {
          requestParams: { query: listTasksQuery },
          responses: { '200': ok('A page of tasks', listOf(taskSchema)), ...errors(400) },
        }),
        post: secured('Tasks', 'Create a task', {
          description: 'Numbers the task within its project (`WEB-1`, `WEB-2`, …).',
          requestBody: json(createTaskSchema),
          responses: { '201': ok('Created', dataOf(taskSchema)), ...errors(400, 404) },
        }),
      },
      '/tasks/{id}': {
        get: secured('Tasks', 'Get a task', {
          requestParams: idPath,
          responses: { '200': ok('The task', dataOf(taskSchema)), ...errors(400, 404) },
        }),
        put: secured('Tasks', 'Update a task (partial body)', {
          description:
            '`{ "status": "COMPLETED" }` marks it complete. `projectId` is ignored (D-008).',
          requestParams: idPath,
          requestBody: json(updateTaskSchema),
          responses: { '200': ok('Updated', dataOf(taskSchema)), ...errors(400, 404) },
        }),
        delete: secured('Tasks', 'Delete a task', {
          requestParams: idPath,
          responses: { ...noContent, ...errors(400, 404) },
        }),
      },
      '/tasks/{id}/activity': {
        get: activityOperation('Tasks', 'History of one task'),
      },
      '/dashboard': {
        get: secured('Dashboard', 'Totals, overdue and upcoming tasks', {
          requestParams: { query: dashboardQuery },
          responses: { '200': ok('The dashboard', dataOf(dashboardSchema)), ...errors(400) },
        }),
      },
    },
  });
}
