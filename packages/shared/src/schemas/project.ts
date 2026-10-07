import { z } from 'zod';
import { PROJECT_STATUSES } from '../enums';
import {
  AT_LEAST_ONE_FIELD_MESSAGE,
  csvEnum,
  hasAtLeastOneField,
  nullableDate,
  nullableDescription,
  paginationSchema,
  searchSchema,
  sortOrderSchema,
  trimmedString,
} from './common';

export const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;

export const projectKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(PROJECT_KEY_PATTERN, { error: 'Use 2–10 letters or digits, starting with a letter' });

export const DATE_RANGE_MESSAGE = 'End date must be on or after start date';

/**
 * `endDate >= startDate` when both are set. Exported because the API re-checks it after merging
 * a partial update with the stored values (only one side may be in the request).
 */
export function isValidDateRange(range: {
  startDate?: string | null;
  endDate?: string | null;
}): boolean {
  const { startDate, endDate } = range;
  return !startDate || !endDate || endDate >= startDate;
}

const dateRangeCheck = { error: DATE_RANGE_MESSAGE, path: ['endDate'] };

const projectFields = z.object({
  name: trimmedString(1, 120),
  description: nullableDescription.optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  startDate: nullableDate.optional(),
  endDate: nullableDate.optional(),
  key: projectKeySchema.optional(),
});

export const createProjectSchema = projectFields.refine(isValidDateRange, dateRangeCheck);
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = projectFields
  .partial()
  .refine(hasAtLeastOneField, { error: AT_LEAST_ONE_FIELD_MESSAGE })
  .refine(isValidDateRange, dateRangeCheck);
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const PROJECT_SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'endDate'] as const;
export type ProjectSortField = (typeof PROJECT_SORT_FIELDS)[number];

export const listProjectsQuerySchema = z.object({
  search: searchSchema.optional(),
  status: csvEnum(PROJECT_STATUSES).optional(),
  sort: z.enum(PROJECT_SORT_FIELDS).default('createdAt'),
  order: sortOrderSchema,
  ...paginationSchema.shape,
});
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
