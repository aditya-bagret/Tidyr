// Date-only values are `YYYY-MM-DD` strings everywhere (D-009). All math here works on UTC
// midnights so a value never shifts by a day because of the device's timezone.
import type { TaskStatus } from '../enums';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(value: string): { year: number; month: number; day: number } | null {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function fromUtcDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** True for a `YYYY-MM-DD` string that is a real calendar date (rejects `2026-02-30`). */
export function isValidDateOnly(value: string): boolean {
  const p = parts(value);
  if (!p) return false;
  // Date.UTC rolls overflow into the next month (Feb 30 → Mar 2); the round trip catches it.
  return fromUtcDate(new Date(Date.UTC(p.year, p.month - 1, p.day))) === value;
}

/** The device's local calendar date. Clients send this as `today` (D-009). */
export function todayLocal(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The UTC calendar date: the API's fallback when a client doesn't send `today`. */
export function todayUtc(now: Date = new Date()): string {
  return fromUtcDate(now);
}

/** Adds (or subtracts) whole days to a `YYYY-MM-DD` date. */
export function addDays(date: string, days: number): string {
  const p = parts(date);
  if (!p) throw new RangeError(`Invalid date-only value: ${date}`);
  return fromUtcDate(new Date(Date.UTC(p.year, p.month - 1, p.day + days)));
}

/** Not completed and due before `today`. ISO dates compare correctly as strings. */
export function isOverdue(
  task: { dueDate: string | null; status: TaskStatus },
  today: string,
): boolean {
  return task.dueDate !== null && task.status !== 'COMPLETED' && task.dueDate < today;
}

/** "Oct 20" in the current year, "Oct 20, 2027" otherwise (DESIGN §5). */
export function formatDate(date: string, today: string): string {
  const p = parts(date);
  if (!p) return date;
  const label = `${MONTHS[p.month - 1] ?? ''} ${p.day}`;
  return date.slice(0, 4) === today.slice(0, 4) ? label : `${label}, ${p.year}`;
}

/** Like `formatDate`, but says "Today" / "Tomorrow" when relevant. */
export function formatDue(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  return formatDate(date, today);
}
