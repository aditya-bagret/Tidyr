import type { ErrorDetail } from '@tidyr/shared';
import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { validationError, zodIssuesToDetails } from '../lib/errors';

export interface RequestSchemas {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
}

const PARTS = ['params', 'query', 'body'] as const;

/**
 * Parses the request parts with the shared Zod schemas and stores the output on `req.validated`.
 * Issues from every part are reported together in one VALIDATION_ERROR.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    const details: ErrorDetail[] = [];
    const validated: Express.Request['validated'] = {};

    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (result.success) validated[part] = result.data;
      else details.push(...zodIssuesToDetails(result.error));
    }

    if (details.length > 0) throw validationError(details);
    req.validated = validated;
    next();
  };
}
