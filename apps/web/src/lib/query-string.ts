/**
 * `URLSearchParams` escapes the commas in CSV filters (`status=PENDING%2CIN_PROGRESS`). Commas are
 * legal in a query string and the shareable URLs in APP_FLOW §1 show them plain. A comma inside a
 * search term comes back unchanged: `URLSearchParams` doesn't treat it as a separator.
 */
export function readableQuery(params: URLSearchParams): string {
  return params.toString().replaceAll('%2C', ',');
}
