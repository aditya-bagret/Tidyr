// /api/docs: Swagger UI and the OpenAPI document (DOC-03, P6.4).
import { todayUtc } from '@tidyr/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createClient, type TestClient } from './helpers/http';

interface Operation {
  security?: unknown[];
  responses: Record<string, unknown>;
  parameters?: Array<{ name: string; in: string; schema: { default?: unknown } }>;
}
interface OpenApiDocument {
  openapi: string;
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, unknown> };
}

// Every route the API mounts (API_CONTRACT §3–§8). A new route must be documented here too.
const OPERATIONS = [
  'GET /health',
  'POST /auth/register',
  'POST /auth/login',
  'POST /auth/refresh',
  'POST /auth/logout',
  'GET /auth/me',
  'GET /projects',
  'POST /projects',
  'GET /projects/{id}',
  'PUT /projects/{id}',
  'DELETE /projects/{id}',
  'GET /projects/{id}/activity',
  'GET /tasks',
  'POST /tasks',
  'GET /tasks/{id}',
  'PUT /tasks/{id}',
  'DELETE /tasks/{id}',
  'GET /tasks/{id}/activity',
  'GET /dashboard',
];
const PUBLIC = ['GET /health', 'POST /auth/register', 'POST /auth/login', 'POST /auth/refresh'];

let request: TestClient;

beforeEach(() => {
  request = createClient();
});

const fetchDocument = async () =>
  (await request.get('/api/docs/openapi.json').expect(200)).body as OpenApiDocument;

const operationsOf = (document: OpenApiDocument) =>
  Object.entries(document.paths).flatMap(([path, item]) =>
    Object.entries(item).map(([method, operation]) => ({
      name: `${method.toUpperCase()} ${path}`,
      operation,
    })),
  );

describe('GET /api/docs/openapi.json', () => {
  it('is an OpenAPI 3.1 document for every route, served without a token', async () => {
    const document = await fetchDocument();

    expect(document.openapi).toBe('3.1.0');
    expect(operationsOf(document).map(({ name }) => name)).toEqual(OPERATIONS);
    expect(Object.keys(document.components.schemas).sort()).toEqual([
      'ActivityEntry',
      'AuthResult',
      'Dashboard',
      'Error',
      'Health',
      'PageMeta',
      'Project',
      'Task',
      'TokenPair',
      'User',
    ]);
  });

  it('marks every protected operation with bearer auth and a 401', async () => {
    for (const { name, operation } of operationsOf(await fetchDocument())) {
      if (PUBLIC.includes(name)) {
        expect(operation.security, name).toBeUndefined();
      } else {
        expect(operation.security, name).toEqual([{ bearerAuth: [] }]);
        expect(Object.keys(operation.responses), name).toContain('401');
      }
    }
  });

  it('shows today’s server date as the default `today`', async () => {
    const document = await fetchDocument();

    for (const path of ['/tasks', '/dashboard']) {
      const today = document.paths[path]?.get?.parameters?.find((param) => param.name === 'today');
      expect(today?.schema.default, path).toBe(todayUtc());
    }
  });
});

describe('GET /api/docs', () => {
  it('redirects to the trailing-slash URL, keeping the query', async () => {
    const res = await request.get('/api/docs').expect(301);
    expect(res.headers.location).toBe('/api/docs/');
    const withQuery = await request.get('/api/docs?x=1').expect(301);
    expect(withQuery.headers.location).toBe('/api/docs/?x=1');
  });

  it('serves Swagger UI pointed at the OpenAPI document', async () => {
    const page = await request.get('/api/docs/').expect(200);
    expect(page.headers['content-type']).toMatch(/text\/html/);
    expect(page.text).toContain('swagger-ui');

    const init = await request.get('/api/docs/swagger-ui-init.js').expect(200);
    expect(init.text).toContain('"url": "openapi.json"');

    await request.get('/api/docs/swagger-ui-bundle.js').expect(200);
    await request.get('/api/docs/package.json').expect(404);
  });
});
