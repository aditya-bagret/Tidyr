interface CspOptions {
  nonce: string;
  apiOrigin: string;
  isDev: boolean;
}

/**
 * TECHNICAL_REQUIREMENTS §9 (D-021). Scripts need the per-request nonce; 'strict-dynamic' lets the
 * scripts Next loads with it load their own chunks. Styles stay 'unsafe-inline' because Radix and
 * sonner set inline style attributes, which nonces can't cover. React needs 'unsafe-eval' in dev
 * only (debug stacks); production never evaluates strings.
 */
export function buildCsp({ nonce, apiOrigin, isDev }: CspOptions): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    'connect-src': ["'self'", apiOrigin],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}
