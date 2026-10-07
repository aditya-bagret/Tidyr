import { z } from 'zod';
import { TASK_PRIORITIES, TASK_STATUSES } from '../enums';
import { todayUtc } from '../utils/dates';
import {
  AT_LEAST_ONE_FIELD_MESSAGE,
  csvEnum,
  dateOnly,
  hasAtLeastOneField,
  nullableDate,
  nullableDescription,
  paginationSchema,
  searchSchema,
  sortOrderSchema,
  trimmedString,
  uuid,
} from './common';

const taskFields = z.object({
  name: trimmedString(1, 200),
  description: nullableDescription.optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  dueDate: nullableDate.optional(),
});

export const createTaskSchema = taskFields.extend({ projectId: uuid });
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

// No `projectId`: a task can't move between projects (D-008), so it's stripped like any unknown key.
export const updateTaskSchema = taskFields
  .partial()
  .refine(hasAtLeastOneField, { error: AT_LEAST_ONE_FIELD_MESSAGE });
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const TASK_DUE_FILTERS = ['overdue', 'today', 'week', 'none'] as const;
export type TaskDueFilter = (typeof TASK_DUE_FILTERS)[number];

export const TASK_SORT_FIELDS = ['createdAt', 'updatedAt', 'dueDate', 'priority', 'name'] as const;
export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

/** Search input that the API also matches as a task key, e.g. `web-12` (API_CONTRACT §6). */
export const TASK_KEY_SEARCH_PATTERN = /^[A-Za-z][A-Za-z0-9]{1,9}-\d+$/;

export const listTasksQuerySchema = z.object({
  projectId: uuid.optional(),
  search: searchSchema.optional(),
  status: csvEnum(TASK_STATUSES).optional(),
  priority: csvEnum(TASK_PRIORITIES).optional(),
  due: z.enum(TASK_DUE_FILTERS).optional(),
  today: dateOnly.default(() => todayUtc()),
  sort: z.enum(TASK_SORT_FIELDS).default('createdAt'),
  order: sortOrderSchema,
  ...paginationSchema.shape,
});
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
