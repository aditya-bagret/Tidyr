// validate(), the errorHandler mapping (TECHNICAL_REQUIREMENTS §4.4) and the limiter factories,
// exercised through a throwaway Express app built inside the test. Nothing here ships.
import express, { type RequestHandler } from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Prisma } from '../../src/generated/prisma/client';
import { AppError, conflict } from '../../src/lib/errors';
import { errorHandler } from '../../src/middleware/errorHandler';
import { createLoginLimiter } from '../../src/middleware/rateLimit';
import { requestId } from '../../src/middleware/requestId';
import { validate } from '../../src/middleware/validate';
import { errorOf } from '../helpers/http';

function appWith(...handlers: RequestHandler[]) {
  const app = express();
  app.use(requestId, express.json());
  app.post('/test/:id', ...handlers);
  app.use(errorHandler);
  return supertest(app);
}

const throwing =
  (error: unknown): RequestHandler =>
  () => {
    throw error;
  };

describe('validate()', () => {
  const schemas = {
    params: z.object({ id: z.uuid() }),
    query: z.object({ page: z.coerce.number().int().min(1).default(1) }),
    body: z.object({ name: z.string().trim().min(1), ownerId: z.never().optional() }).strip(),
  };
  const echo: RequestHandler = (req, res) => {
    res.json(req.validated);
  };
  const id = '0b6f0f1e-6a4b-4c1e-9a7a-2b8e3c1d4f5a';

  it('stores the parsed output on req.validated', async () => {
    const res = await appWith(validate(schemas), echo)
      .post(`/test/${id}?page=2`)
      .send({ name: '  Website  ' })
      .expect(200);
    expect(res.body).toEqual({ params: { id }, query: { page: 2 }, body: { name: 'Website' } });
  });

  it('reports the issues from every part in one VALIDATION_ERROR', async () => {
    const res = await appWith(validate(schemas), echo)
      .post('/test/not-a-uuid?page=0')
      .send({ name: '   ' })
      .expect(400);
    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    expect(errorOf(res).message).toBe('Invalid request');
    expect(errorOf(res).details?.map((d) => d.path)).toEqual(['id', 'page', 'name']);
  });
});

describe('errorHandler', () => {
  it('sends an AppError with its status, code and details', async () => {
    const error = conflict('Key already used', [{ path: 'key', message: 'Taken' }]);
    const res = await appWith(throwing(error)).post('/test/1').expect(409);
    expect(res.body).toEqual({
      error: {
        code: 'CONFLICT',
        message: 'Key already used',
        details: [{ path: 'key', message: 'Taken' }],
      },
    });
  });

  it('maps a ZodError to VALIDATION_ERROR', async () => {
    const zodError = z.object({ email: z.email() }).safeParse({ email: 'nope' }).error;
    const res = await appWith(throwing(zodError)).post('/test/1').expect(400);
    expect(errorOf(res)).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [{ path: 'email', message: expect.any(String) as string }],
    });
  });

  it.each([
    ['P2002', 409, 'CONFLICT'],
    ['P2025', 404, 'NOT_FOUND'],
  ])('maps Prisma %s to %i %s', async (code, status, apiCode) => {
    const error = new Prisma.PrismaClientKnownRequestError('internal prisma text', {
      code,
      clientVersion: Prisma.prismaVersion.client,
    });
    const res = await appWith(throwing(error)).post('/test/1').expect(status);
    expect(errorOf(res).code).toBe(apiCode);
    expect(res.text).not.toContain('internal prisma text');
  });

  it('turns any other Prisma error into a generic 500', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('relation "x" does not exist', {
      code: 'P2010',
      clientVersion: Prisma.prismaVersion.client,
    });
    const res = await appWith(throwing(error)).post('/test/1').expect(500);
    expect(errorOf(res)).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
      requestId: res.headers['x-request-id'],
    });
  });

  it('turns a thrown non-Error value into a generic 500', async () => {
    const res = await appWith(throwing('just a string')).post('/test/1').expect(500);
    expect(errorOf(res).code).toBe('INTERNAL_ERROR');
  });

  it('handles rejected promises from async handlers (Express 5)', async () => {
    const asyncHandler: RequestHandler = async () => {
      await Promise.resolve();
      throw new AppError(404, 'NOT_FOUND', 'Project not found');
    };
    const res = await appWith(asyncHandler).post('/test/1').expect(404);
    expect(errorOf(res)).toEqual({ code: 'NOT_FOUND', message: 'Project not found' });
  });
});

describe('createLoginLimiter (RATE_LIMIT_AUTH_MAX=5 in .env.test)', () => {
  function loginApp() {
    const app = express();
    app.use(express.json());
    app.post('/login', createLoginLimiter(), (req, res) => {
      const body = req.body as { password?: string };
      res.sendStatus(body.password === 'right' ? 200 : 401);
    });
    app.use(errorHandler);
    return supertest(app);
  }

  it('limits failed attempts per IP + email with a RATE_LIMITED envelope and Retry-After', async () => {
    const request = loginApp();
    for (let i = 0; i < 5; i++) {
      await request.post('/login').send({ email: 'a@tidyr.test', password: 'wrong' }).expect(401);
    }

    const limited = await request
      .post('/login')
      .send({ email: ' A@Tidyr.test ', password: 'right' })
      .expect(429);
    expect(errorOf(limited).code).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(limited.headers.ratelimit).toBeDefined();

    // Another account from the same IP is unaffected (D-015).
    await request.post('/login').send({ email: 'b@tidyr.test', password: 'right' }).expect(200);
  });

  it('does not count successful logins', async () => {
    const request = loginApp();
    for (let i = 0; i < 8; i++) {
      await request.post('/login').send({ email: 'a@tidyr.test', password: 'right' }).expect(200);
    }
  });
});
