export const FALLBACK_PROJECT_KEY = 'PRJ';

/**
 * Suggests a project key from its name (API_CONTRACT §5): the initials of up to 4 words, or the
 * first 3 letters of a single word, A–Z only. Fewer than 2 letters falls back to `PRJ`.
 * Uniqueness (the `WR2` suffix) is the API's job, since it needs the user's existing keys.
 */
export function suggestProjectKey(name: string): string {
  const words = name
    .toUpperCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Z]/g, ''))
    .filter((word) => word.length > 0);

  const key =
    words.length === 1
      ? (words[0] ?? '').slice(0, 3)
      : words
          .slice(0, 4)
          .map((word) => word[0])
          .join('');

  return key.length >= 2 ? key : FALLBACK_PROJECT_KEY;
}
