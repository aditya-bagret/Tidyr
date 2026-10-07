// Cross-cutting behaviour of createApp() (TEST_PLAN §3.6, T-X-01…T-X-08).
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertNoSensitiveFields, createClient, errorOf } from './helpers/http';

const request = createClient();
const ALLOWED_ORIGIN = 'https://allowed.example.com';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/health', () => {
  it('returns 200 with status and uptime', async () => {
    const res = await request.get('/api/health').expect(200);
    expect(res.body).toEqual({ data: { status: 'ok', uptime: expect.any(Number) as number } });
  });

  it('is mounted before the API rate limiter', async () => {
    const health = await request.get('/api/health');
    expect(health.headers.ratelimit).toBeUndefined();

    const other = await request.get('/api/unknown');
    expect(other.headers.ratelimit).toBeDefined();
    expect(other.headers['ratelimit-policy']).toBeDefined();
  });
});

describe('T-X-01 unknown route', () => {
  it.each(['/api/does-not-exist', '/nope', '/api/health/extra'])(
    '%s → 404 envelope',
    async (url) => {
      const res = await request.get(url).expect(404);
      expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
    },
  );
});

describe('T-X-02 malformed JSON', () => {
  it('returns 400 INVALID_JSON', async () => {
    const res = await request
      .post('/api/anything')
      .set('Content-Type', 'application/json')
      .send('{"name": ')
      .expect(400);
    expect(res.body).toEqual({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } });
  });

  it('treats an unsupported charset as an unreadable body, not a 500', async () => {
    const res = await request
      .post('/api/anything')
      .set('Content-Type', 'application/json; charset=klingon')
      .send('{}')
      .expect(400);
    expect(errorOf(res).code).toBe('INVALID_JSON');
  });
});

describe('T-X-03 body size limit', () => {
  it('returns 413 PAYLOAD_TOO_LARGE above 100 kb', async () => {
    const res = await request
      .post('/api/anything')
      .send({ description: 'x'.repeat(101 * 1024) })
      .expect(413);
    expect(errorOf(res).code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('accepts a body just under the limit (then 404s on the unknown route)', async () => {
    const res = await request
      .post('/api/anything')
      .send({ description: 'x'.repeat(99 * 1024) })
      .expect(404);
    expect(errorOf(res).code).toBe('NOT_FOUND');
  });
});

describe('T-X-04 unexpected errors', () => {
  it('returns a generic 500 with the request id and no internals', async () => {
    vi.spyOn(process, 'uptime').mockImplementation(() => {
      throw new Error('secret internal detail at /srv/app/db.ts');
    });

    const res = await request.get('/api/health').expect(500);

    expect(res.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong',
        requestId: res.headers['x-request-id'],
      },
    });
    expect(res.text).not.toContain('secret internal detail');
    expect(res.text).not.toContain('stack');
    expect(res.text).not.toContain('.ts');
  });
});

describe('T-X-05 X-Request-Id', () => {
  it.each([
    ['200', '/api/health', 200],
    ['404', '/api/unknown', 404],
  ])('is set on a %s response', async (_label, url, status) => {
    const res = await request.get(url).expect(status);
    expect(res.headers['x-request-id']).toMatch(UUID_PATTERN);
  });

  it('is set on a 400 response', async () => {
    const res = await request
      .post('/api/x')
      .set('Content-Type', 'application/json')
      .send('nope')
      .expect(400);
    expect(res.headers['x-request-id']).toMatch(UUID_PATTERN);
  });

  it('echoes a valid incoming UUID', async () => {
    const id = randomUUID();
    const res = await request.get('/api/health').set('X-Request-Id', id);
    expect(res.headers['x-request-id']).toBe(id);
  });

  it('replaces an invalid incoming id', async () => {
    const res = await request.get('/api/health').set('X-Request-Id', 'not-a-uuid <script>');
    expect(res.headers['x-request-id']).toMatch(UUID_PATTERN);
    expect(res.headers['x-request-id']).not.toContain('not-a-uuid');
  });

  it('is a different id on every request', async () => {
    const [a, b] = await Promise.all([request.get('/api/health'), request.get('/api/health')]);
    expect(a.headers['x-request-id']).not.toBe(b.headers['x-request-id']);
  });
});

describe('T-X-06 CORS', () => {
  it('allows a listed origin and exposes the headers the client reads', async () => {
    const res = await request.get('/api/health').set('Origin', ALLOWED_ORIGIN).expect(200);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(res.headers['access-control-expose-headers']).toBe('Retry-After,X-Request-Id');
  });

  it('answers a preflight from a listed origin', async () => {
    const res = await request
      .options('/api/projects')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'PUT')
      .set('Access-Control-Request-Headers', 'Authorization, Content-Type')
      .expect(204);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-methods']).toBe('GET,POST,PUT,PATCH,DELETE');
    expect(res.headers['access-control-allow-headers']).toBe(
      'Content-Type,Authorization,X-Request-Id',
    );
    expect(res.headers['access-control-max-age']).toBe('600');
  });

  it('sends no CORS headers to an unlisted origin (and does not error)', async () => {
    const res = await request.get('/api/health').set('Origin', 'https://evil.example.com');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();

    const preflight = await request
      .options('/api/projects')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'DELETE');
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
    expect(preflight.status).not.toBe(500);
  });

  it('allows requests without an Origin (mobile, curl)', async () => {
    const res = await request.get('/api/health').expect(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('T-X-07 security headers', () => {
  it('sets the helmet headers and hides the framework', async () => {
    const res = await request.get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['strict-transport-security']).toContain('max-age=');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('T-X-08 sensitive-field helper', () => {
  it('fails a response that contains a sensitive field', () => {
    const leaky = { text: '{"data":{"id":"1","passwordHash":"$2b$..."}}' };
    expect(() =>
      assertNoSensitiveFields(leaky as Parameters<typeof assertNoSensitiveFields>[0]),
    ).toThrow(/passwordHash/);
  });

  it('passes a clean response', () => {
    const clean = { text: '{"data":{"id":"1"}}' };
    expect(() =>
      assertNoSensitiveFields(clean as Parameters<typeof assertNoSensitiveFields>[0]),
    ).not.toThrow();
  });
});
