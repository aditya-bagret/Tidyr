/**
 * Escapes LIKE wildcards so a Prisma `contains` filter matches the text literally: without it,
 * searching for `%` or `_` would match every row. Backslash is Postgres's default LIKE escape.
 */
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}
