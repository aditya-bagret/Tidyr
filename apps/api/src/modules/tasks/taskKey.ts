import { TASK_KEY_SEARCH_PATTERN } from '@tidyr/shared';

// `tasks.number` is a Postgres int4. A larger number can't match any task, and passing it to Prisma
// would fail the query, so such a search is treated as a plain name search.
const MAX_TASK_NUMBER = 2_147_483_647;

/** `WEB-12`: derived at read time, never stored (SCHEMA §4.6). */
export function formatTaskKey(projectKey: string, number: number): string {
  return `${projectKey}-${number}`;
}

/** `web-12` → `{ projectKey: 'WEB', number: 12 }`, or `null` if the text isn't a task key. */
export function parseTaskKey(text: string): { projectKey: string; number: number } | null {
  if (!TASK_KEY_SEARCH_PATTERN.test(text)) return null;
  const separator = text.lastIndexOf('-');
  const number = Number(text.slice(separator + 1));
  if (number > MAX_TASK_NUMBER) return null;
  return { projectKey: text.slice(0, separator).toUpperCase(), number };
}
