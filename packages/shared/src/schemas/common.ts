import { z } from 'zod';
import { isValidDateOnly } from '../utils/dates';

export const uuid = z.uuid({ error: 'Must be a valid id' });

export const idParamSchema = z.object({ id: uuid });
export type IdParam = z.infer<typeof idParamSchema>;

/** `YYYY-MM-DD` that is a real calendar date. */
export const dateOnly = z
  .string()
  .refine(isValidDateOnly, { error: 'Must be a real date in YYYY-MM-DD format' });

export const nullableDate = dateOnly.nullable();

/** Client forms only: a cleared native date input yields `''`, which means "no date". */
export const formDate = z.union([z.literal('').transform(() => null), dateOnly]);

/** Trims first, so a whitespace-only value fails the minimum (TECHNICAL_REQUIREMENTS §7). */
export function trimmedString(min: number, max: number) {
  return z
    .string()
    .trim()
    .min(min, { error: min <= 1 ? 'Required' : `Must be at least ${min} characters` })
    .max(max, { error: `Must be at most ${max} characters` });
}

/** Optional long text: an empty string is stored as `null`. */
export const nullableDescription = z
  .string()
  .trim()
  .max(5000, { error: 'Must be at most 5000 characters' })
  .transform((value) => (value === '' ? null : value))
  .nullable();

/** Comma-separated enum list from a query string → de-duplicated array. An empty value is ignored. */
export function csvEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z
    .string()
    .transform((raw) => [
      ...new Set(
        raw
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item !== ''),
      ),
    ])
    .pipe(z.array(z.enum(values)))
    .transform((items) => (items.length > 0 ? items : undefined));
}

/** Free-text search: trimmed, and an empty value is ignored. */
export const searchSchema = z
  .string()
  .trim()
  .max(100, { error: 'Must be at most 100 characters' })
  .transform((value) => (value === '' ? undefined : value));

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof paginationSchema>;

export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');
export type SortOrder = z.infer<typeof sortOrderSchema>;

/** At least one field must be present after unknown keys are stripped (D-007). */
export function hasAtLeastOneField(value: Record<string, unknown>): boolean {
  return Object.values(value).some((field) => field !== undefined);
}

export const AT_LEAST_ONE_FIELD_MESSAGE = 'Provide at least one field to update';
