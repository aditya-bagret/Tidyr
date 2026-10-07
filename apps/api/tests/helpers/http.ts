import type { ErrorBody } from '@tidyr/shared';
import type { Express } from 'express';
import supertest, { type Response } from 'supertest';
import { createApp } from '../../src/app';

/** Strings that must never appear in any response body (T-X-08, SEC-03). */
export const SENSITIVE_FIELDS = [
  'passwordHash',
  'password_hash',
  'refreshTokenHash',
  'refresh_token_hash',
  'previousTokenHash',
  'previous_token_hash',
] as const;

export function assertNoSensitiveFields(res: Response): void {
  const body = res.text ?? '';
  const leaked = SENSITIVE_FIELDS.filter((field) => body.includes(field));
  if (leaked.length > 0) {
    throw new Error(`Response leaks sensitive field(s): ${leaked.join(', ')}`);
  }
}

/** The typed `error` object of an error response (supertest types `body` as `any`). */
export function errorOf(res: { body: unknown }): ErrorBody['error'] {
  return (res.body as ErrorBody).error;
}

/**
 * A supertest client whose every response is checked by `assertNoSensitiveFields`, so the T-X-08
 * check runs in every test that uses it. Each test file gets its own app (and limiter stores).
 */
export function createClient(app: Express = createApp()) {
  const agent = supertest(app);
  return {
    get: (url: string) => agent.get(url).expect(assertNoSensitiveFields),
    post: (url: string) => agent.post(url).expect(assertNoSensitiveFields),
    put: (url: string) => agent.put(url).expect(assertNoSensitiveFields),
    patch: (url: string) => agent.patch(url).expect(assertNoSensitiveFields),
    delete: (url: string) => agent.delete(url).expect(assertNoSensitiveFields),
    options: (url: string) => agent.options(url).expect(assertNoSensitiveFields),
  };
}
