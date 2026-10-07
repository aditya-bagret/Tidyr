export type QueryValue = string | number | readonly string[] | null | undefined;
export type QueryParams = Record<string, QueryValue>;

/**
 * Builds `?a=1&status=PENDING,IN_PROGRESS`. Arrays become the comma lists the API expects
 * (API_CONTRACT §2.1); empty values and empty arrays are left out. Hand-rolled because React
 * Native's `URLSearchParams` is incomplete.
 */
export function buildQueryString(params?: QueryParams): string {
  if (!params) return '';
  const pairs: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const encoded =
      typeof value === 'string' || typeof value === 'number'
        ? encodeURIComponent(value)
        : value.map((item) => encodeURIComponent(item)).join(',');
    if (encoded !== '') pairs.push(`${encodeURIComponent(key)}=${encoded}`);
  }

  return pairs.length > 0 ? `?${pairs.join('&')}` : '';
}
