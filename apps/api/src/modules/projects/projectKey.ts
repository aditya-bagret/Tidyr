/**
 * The first of `base`, `base2`, `base3`, … that isn't in `taken` (API_CONTRACT §5). Suggested
 * bases are at most 4 letters, so the result stays within the 10-character key limit.
 */
export function firstFreeKey(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const key = `${base}${suffix}`;
    if (!taken.has(key)) return key;
  }
}
