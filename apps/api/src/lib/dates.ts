// The only place that converts between API date-only strings and `@db.Date` columns (D-009).
// Prisma reads and writes DATE columns as JavaScript Dates at UTC midnight, so the conversion
// works in UTC and never depends on the server's timezone.
import { isValidDateOnly } from '@tidyr/shared';

/** `Date` at UTC midnight → `YYYY-MM-DD`. */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` → `Date` at UTC midnight. Throws on an invalid calendar date. */
export function fromDateOnly(value: string): Date {
  if (!isValidDateOnly(value)) throw new RangeError(`Invalid date-only value: ${value}`);
  return new Date(`${value}T00:00:00.000Z`);
}

export function toDateOnlyOrNull(date: Date | null): string | null {
  return date === null ? null : toDateOnly(date);
}

/** `undefined` (field not sent) stays `undefined` so partial updates leave the column alone. */
export function fromDateOnlyOrNull(value: string | null): Date | null;
export function fromDateOnlyOrNull(value: string | null | undefined): Date | null | undefined;
export function fromDateOnlyOrNull(value: string | null | undefined): Date | null | undefined {
  if (value === undefined || value === null) return value;
  return fromDateOnly(value);
}
