// /api/projects integration tests (TEST_PLAN §3.3, T-PRJ-01…22) against the real tidyr_test database.
import { randomUUID } from 'node:crypto';
import type { ListResponse, Project } from '@tidyr/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { resetDb } from './helpers/db';
import { createProject, createUser, insertTask, loginAs } from './helpers/factories';
import { createClient, dataOf, errorOf, type TestClient } from './helpers/http';

const PROJECTS = '/api/projects';
const projectUrl = (id: string) => `${PROJECTS}/${id}`;
const bearer = (token: string) => `Bearer ${token}`;

const PROJECT_FIELDS = [
  'createdAt',
  'description',
  'endDate',
  'id',
  'key',
  'name',
  'startDate',
  'status',
  'taskCounts',
  'updatedAt',
];
const ZERO_COUNTS = { total: 0, pending: 0, inProgress: 0, completed: 0 };

let request: TestClient;
let token: string;
let otherToken: string;
let userId: string;

beforeEach(async () => {
  await resetDb();
  request = createClient();
  const [user, other] = await Promise.all([createUser(), createUser()]);
  userId = user.id;
  token = (await loginAs(request, user)).accessToken;
  otherToken = (await loginAs(request, other)).accessToken;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const post = (body: unknown, as = token) =>
  request
    .post(PROJECTS)
    .set('Authorization', bearer(as))
    .send(body as object);
const put = (id: string, body: unknown, as = token) =>
  request
    .put(projectUrl(id))
    .set('Authorization', bearer(as))
    .send(body as object);
const getOne = (id: string, as = token) =>
  request.get(projectUrl(id)).set('Authorization', bearer(as));
const del = (id: string, as = token) =>
  request.delete(projectUrl(id)).set('Authorization', bearer(as));
const listProjects = async (query = '', as = token) => {
  const res = await request.get(`${PROJECTS}${query}`).set('Authorization', bearer(as)).expect(200);
  return res.body as ListResponse<Project>;
};
const namesOf = (list: ListResponse<Project>) => list.data.map((project) => project.name);

const auditRows = (entityId: string) =>
  prisma.auditLog.findMany({ where: { entityId }, orderBy: { createdAt: 'asc' } });
const projectRow = (id: string) => prisma.project.findUnique({ where: { id } });

describe('POST /api/projects', () => {
  it('T-PRJ-01 creates with only a name: NOT_STARTED, auto key, zero task counts', async () => {
    const res = await post({ name: 'Website Redesign' }).expect(201);
    const project = dataOf<Project>(res);

    expect(Object.keys(project).sort()).toEqual(PROJECT_FIELDS);
    expect(project).toMatchObject({
      key: 'WR',
      name: 'Website Redesign',
      description: null,
      status: 'NOT_STARTED',
      startDate: null,
      endDate: null,
      taskCounts: ZERO_COUNTS,
    });
    expect(new Date(project.createdAt).toISOString()).toBe(project.createdAt);
    const row = await projectRow(project.id);
    expect(row?.ownerId).toBe(userId);
  });

  it('T-PRJ-02 creates with all fields; dates echo as YYYY-MM-DD; key is normalized', async () => {
    const res = await post({
      name: '  Marketing site  ',
      description: 'Q4 refresh of marketing site',
      status: 'IN_PROGRESS',
      startDate: '2026-10-10',
      endDate: '2026-12-15',
      key: ' web ',
    }).expect(201);

    expect(dataOf<Project>(res)).toMatchObject({
      key: 'WEB',
      name: 'Marketing site',
      description: 'Q4 refresh of marketing site',
      status: 'IN_PROGRESS',
      startDate: '2026-10-10',
      endDate: '2026-12-15',
    });
  });

  it('stores an empty description as null and ignores fields clients may not set', async () => {
    const foreignId = randomUUID();
    const res = await post({
      name: 'Ops',
      description: '   ',
      id: foreignId,
      ownerId: foreignId,
      taskSeq: 99,
    }).expect(201);
    const project = dataOf<Project>(res);

    expect(project.description).toBeNull();
    expect(project.id).not.toBe(foreignId);
    const row = await projectRow(project.id);
    expect(row).toMatchObject({ ownerId: userId, taskSeq: 0 });
  });

  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
    ['121-character', 'x'.repeat(121)],
    ['missing', undefined],
  ])('T-PRJ-03 rejects a %s name', async (_label, name) => {
    const res = await post({ name }).expect(400);
    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    expect(errorOf(res).details?.map((detail) => detail.path)).toEqual(['name']);
    expect(await prisma.project.count()).toBe(0);
  });

  it.each([
    ['an invalid status', { status: 'DONE' }, 'status'],
    ['a lowercase status', { status: 'in_progress' }, 'status'],
    ['an impossible date', { startDate: '2026-02-30' }, 'startDate'],
    ['a non-ISO date', { endDate: '15/12/2026' }, 'endDate'],
    [
      'an end date before the start date',
      { startDate: '2026-10-10', endDate: '2026-10-09' },
      'endDate',
    ],
    ['a malformed key', { key: '1AB' }, 'key'],
  ])('T-PRJ-04 rejects %s with the field path', async (_label, fields, path) => {
    const res = await post({ name: 'Website', ...fields }).expect(400);
    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    expect(errorOf(res).details?.map((detail) => detail.path)).toEqual([path]);
    expect(await prisma.project.count()).toBe(0);
  });

  it('T-PRJ-05 rejects an explicit key the caller already uses with 409 CONFLICT on key', async () => {
    await createProject(request, token, { key: 'WEB' });
    const res = await post({ name: 'Another', key: 'web' }).expect(409);

    expect(errorOf(res).code).toBe('CONFLICT');
    expect(errorOf(res).details?.map((detail) => detail.path)).toEqual(['key']);
    expect(await prisma.project.count()).toBe(1);
  });

  it('T-PRJ-06 adds a number suffix when the generated key is taken', async () => {
    const keys: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      keys.push((await createProject(request, token, { name: 'Website Redesign' })).key);
    }
    expect(keys).toEqual(['WR', 'WR2', 'WR3']);

    // Explicit keys count as taken too, and the first free suffix wins.
    await createProject(request, token, { name: 'Mobile', key: 'MOB' });
    await createProject(request, token, { name: 'Other', key: 'MOB3' });
    expect((await createProject(request, token, { name: 'Mobile' })).key).toBe('MOB2');
    expect((await createProject(request, token, { name: 'Mobile' })).key).toBe('MOB4');
  });

  it('generates keys from initials, a single word, or falls back to PRJ', async () => {
    const cases = [
      ['Q4 marketing push for the website', 'QMPF'],
      ['Marketing', 'MAR'],
      ['42', 'PRJ'],
      ['ü', 'PRJ2'],
    ] as const;
    for (const [name, key] of cases) {
      expect((await createProject(request, token, { name })).key).toBe(key);
    }
  });

  it('gives concurrent creates of one name distinct generated keys', async () => {
    const results = await Promise.all(
      Array.from({ length: 3 }, () => post({ name: 'Website Redesign' })),
    );
    expect(results.map((res) => res.status)).toEqual([201, 201, 201]);
    expect(results.map((res) => dataOf<Project>(res).key).sort()).toEqual(['WR', 'WR2', 'WR3']);
  });

  it('T-PRJ-07 allows the same key for different users', async () => {
    const mine = await createProject(request, token, { key: 'WEB' });
    const theirs = await createProject(request, otherToken, { key: 'WEB' });
    expect([mine.key, theirs.key]).toEqual(['WEB', 'WEB']);

    // Auto keys are per user too.
    expect((await createProject(request, otherToken, { name: 'Website Redesign' })).key).toBe('WR');
  });
});

describe('GET /api/projects', () => {
  it('T-PRJ-08 returns only the caller’s projects', async () => {
    await createProject(request, token, { name: 'Mine A' });
    await createProject(request, token, { name: 'Mine B' });
    await createProject(request, otherToken, { name: 'Theirs' });

    const list = await listProjects();
    expect(namesOf(list).sort()).toEqual(['Mine A', 'Mine B']);
    expect(list.meta.total).toBe(2);
    expect(Object.keys(list.data[0] ?? {}).sort()).toEqual(PROJECT_FIELDS);
  });

  it('T-PRJ-09 search is a case-insensitive "contains" on name', async () => {
    await createProject(request, token, { name: 'Website Redesign' });
    await createProject(request, token, { name: 'Mobile WEB app' });
    await createProject(request, token, { name: 'Payroll' });
    await createProject(request, token, { name: '100% done_ish' });
    await createProject(request, otherToken, { name: 'Their website' });

    expect(namesOf(await listProjects('?search=web&sort=name&order=asc'))).toEqual([
      'Mobile WEB app',
      'Website Redesign',
    ]);
    expect(namesOf(await listProjects('?search=%20%20REDESIGN%20'))).toEqual(['Website Redesign']);
    // LIKE wildcards are matched literally, and an empty search is ignored.
    expect(namesOf(await listProjects('?search=%25'))).toEqual(['100% done_ish']);
    expect(namesOf(await listProjects('?search=_'))).toEqual(['100% done_ish']);
    expect(namesOf(await listProjects('?search=0%25%20d'))).toEqual(['100% done_ish']);
    expect((await listProjects('?search=%5C')).meta.total).toBe(0);
    expect((await listProjects('?search=')).meta.total).toBe(4);
  });

  it('rejects a search over 100 characters', async () => {
    const res = await request
      .get(`${PROJECTS}?search=${'a'.repeat(101)}`)
      .set('Authorization', bearer(token))
      .expect(400);
    expect(errorOf(res).details?.map((detail) => detail.path)).toEqual(['search']);
  });

  it('T-PRJ-10 filters by one or several statuses', async () => {
    await createProject(request, token, { name: 'Todo', status: 'NOT_STARTED' });
    await createProject(request, token, { name: 'Doing', status: 'IN_PROGRESS' });
    await createProject(request, token, { name: 'Done', status: 'COMPLETED' });

    expect(namesOf(await listProjects('?status=IN_PROGRESS'))).toEqual(['Doing']);
    expect(
      namesOf(await listProjects('?status=COMPLETED,NOT_STARTED&sort=name&order=asc')),
    ).toEqual(['Done', 'Todo']);

    const res = await request
      .get(`${PROJECTS}?status=IN_PROGRESS,DONE`)
      .set('Authorization', bearer(token))
      .expect(400);
    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    expect(errorOf(res).details?.[0]?.path).toMatch(/^status/);
  });

  it('T-PRJ-11 paginates with real meta, including past the last page', async () => {
    for (let i = 1; i <= 5; i += 1) await createProject(request, token, { name: `Project ${i}` });

    const first = await listProjects('?limit=2');
    expect(first.meta).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
    expect(first.data).toHaveLength(2);

    const last = await listProjects('?limit=2&page=3');
    expect(last.data).toHaveLength(1);

    const seen = [...first.data, ...(await listProjects('?limit=2&page=2')).data, ...last.data];
    expect(new Set(seen.map((project) => project.id)).size).toBe(5);

    const past = await listProjects('?limit=2&page=4');
    expect(past).toEqual({ data: [], meta: { page: 4, limit: 2, total: 5, totalPages: 3 } });

    expect((await listProjects()).meta).toEqual({ page: 1, limit: 20, total: 5, totalPages: 1 });
    expect((await listProjects('?limit=100')).meta.limit).toBe(100);
  });

  it('T-PRJ-11 reports zero pages for an empty list', async () => {
    expect(await listProjects()).toEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it.each([
    ['limit=0', 'limit'],
    ['limit=101', 'limit'],
    ['limit=abc', 'limit'],
    ['page=0', 'page'],
    ['page=1.5', 'page'],
  ])('T-PRJ-11 rejects out-of-range pagination (%s)', async (query, path) => {
    const res = await request
      .get(`${PROJECTS}?${query}`)
      .set('Authorization', bearer(token))
      .expect(400);
    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    expect(errorOf(res).details?.map((detail) => detail.path)).toEqual([path]);
  });

  it('T-PRJ-12 sorts by name and by endDate with nulls last in both directions', async () => {
    await createProject(request, token, { name: 'Charlie', endDate: '2026-12-01' });
    await createProject(request, token, { name: 'Alpha' });
    await createProject(request, token, { name: 'Bravo', endDate: '2026-11-01' });
    await createProject(request, token, { name: 'Delta', endDate: '2027-01-01' });

    expect(namesOf(await listProjects('?sort=name&order=asc'))).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
      'Delta',
    ]);
    expect(namesOf(await listProjects('?sort=name&order=desc'))).toEqual([
      'Delta',
      'Charlie',
      'Bravo',
      'Alpha',
    ]);
    expect(namesOf(await listProjects('?sort=endDate&order=asc'))).toEqual([
      'Bravo',
      'Charlie',
      'Delta',
      'Alpha',
    ]);
    expect(namesOf(await listProjects('?sort=endDate&order=desc'))).toEqual([
      'Delta',
      'Charlie',
      'Bravo',
      'Alpha',
    ]);
  });

  it('T-PRJ-12 defaults to createdAt desc and supports updatedAt', async () => {
    const created = [];
    for (const name of ['Old', 'Middle', 'New']) {
      created.push(await createProject(request, token, { name }));
    }
    const base = Date.parse('2026-01-01T00:00:00Z');
    for (const [index, project] of created.entries()) {
      await prisma.project.update({
        where: { id: project.id },
        data: { createdAt: new Date(base + index * 60_000) },
      });
    }

    expect(namesOf(await listProjects())).toEqual(['New', 'Middle', 'Old']);
    expect(namesOf(await listProjects('?order=asc'))).toEqual(['Old', 'Middle', 'New']);

    await put(created[0]?.id ?? '', { status: 'IN_PROGRESS' }).expect(200);
    expect(namesOf(await listProjects('?sort=updatedAt'))[0]).toBe('Old');

    const res = await request
      .get(`${PROJECTS}?sort=owner&order=sideways`)
      .set('Authorization', bearer(token))
      .expect(400);
    expect(
      errorOf(res)
        .details?.map((detail) => detail.path)
        .sort(),
    ).toEqual(['order', 'sort']);
  });

  it('T-PRJ-13 returns correct taskCounts per project from a single groupBy', async () => {
    const busy = await createProject(request, token, { name: 'Busy' });
    const quiet = await createProject(request, token, { name: 'Quiet' });
    const empty = await createProject(request, token, { name: 'Empty' });
    for (const status of ['PENDING', 'PENDING', 'IN_PROGRESS', 'COMPLETED'] as const) {
      await insertTask(busy.id, status);
    }
    await insertTask(quiet.id, 'COMPLETED');

    const groupBy = vi.spyOn(prisma.task, 'groupBy');
    const list = await listProjects();
    expect(groupBy).toHaveBeenCalledTimes(1);

    const countsByName = Object.fromEntries(list.data.map((p) => [p.name, p.taskCounts]));
    expect(countsByName).toEqual({
      Busy: { total: 4, pending: 2, inProgress: 1, completed: 1 },
      Quiet: { total: 1, pending: 0, inProgress: 0, completed: 1 },
      Empty: ZERO_COUNTS,
    });

    expect(dataOf<Project>(await getOne(busy.id).expect(200)).taskCounts).toEqual(
      countsByName.Busy,
    );
    expect(dataOf<Project>(await getOne(empty.id).expect(200)).taskCounts).toEqual(ZERO_COUNTS);
  });
});

describe('GET /api/projects/:id', () => {
  it('T-PRJ-14 returns the caller’s own project', async () => {
    const created = await createProject(request, token, {
      description: 'Notes',
      startDate: '2026-10-01',
    });
    const res = await getOne(created.id).expect(200);
    expect(dataOf<Project>(res)).toEqual(created);
  });

  it('T-PRJ-15 returns 404 NOT_FOUND for another user’s project', async () => {
    const theirs = await createProject(request, otherToken);
    const res = await getOne(theirs.id).expect(404);
    expect(errorOf(res).code).toBe('NOT_FOUND');
    expect(res.text).not.toContain(theirs.name);
  });

  it('T-PRJ-16 returns 404 for an unknown uuid and 400 for a non-uuid', async () => {
    const missing = await getOne(randomUUID()).expect(404);
    expect(errorOf(missing).code).toBe('NOT_FOUND');

    const bad = await getOne('not-a-uuid').expect(400);
    expect(errorOf(bad).code).toBe('VALIDATION_ERROR');
    expect(errorOf(bad).details?.map((detail) => detail.path)).toEqual(['id']);
  });
});

describe('PUT /api/projects/:id', () => {
  it('T-PRJ-17 applies a partial update and leaves the other fields unchanged', async () => {
    const created = await createProject(request, token, {
      name: 'Website',
      description: 'Notes',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      key: 'WEB',
    });
    await insertTask(created.id, 'PENDING');

    const res = await put(created.id, { status: 'COMPLETED' }).expect(200);
    const updated = dataOf<Project>(res);

    expect(updated).toEqual({
      ...created,
      status: 'COMPLETED',
      taskCounts: { total: 1, pending: 1, inProgress: 0, completed: 0 },
      updatedAt: updated.updatedAt,
    });
    expect(Date.parse(updated.updatedAt)).toBeGreaterThan(Date.parse(created.updatedAt));
    expect(dataOf<Project>(await getOne(created.id).expect(200))).toEqual(updated);
  });

  it('clears nullable fields with null and changes the key', async () => {
    const created = await createProject(request, token, {
      description: 'Notes',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    });
    const res = await put(created.id, {
      description: null,
      startDate: null,
      endDate: null,
      key: 'site',
      name: ' Site ',
    }).expect(200);

    expect(dataOf<Project>(res)).toMatchObject({
      description: null,
      startDate: null,
      endDate: null,
      key: 'SITE',
      name: 'Site',
    });
  });

  it('T-PRJ-18 checks the date range after merging with the stored dates', async () => {
    const created = await createProject(request, token, {
      startDate: '2026-10-10',
      endDate: '2026-10-20',
    });
    const before = await projectRow(created.id);

    for (const body of [{ endDate: '2026-10-09' }, { startDate: '2026-10-21' }]) {
      const res = await put(created.id, body).expect(400);
      expect(errorOf(res).code).toBe('VALIDATION_ERROR');
      expect(errorOf(res).details).toEqual([
        { path: 'endDate', message: 'End date must be on or after start date' },
      ]);
    }
    expect(await projectRow(created.id)).toEqual(before);

    // Moving both together, or clearing one side, is fine.
    await put(created.id, { startDate: '2026-11-01', endDate: '2026-11-02' }).expect(200);
    await put(created.id, { startDate: null }).expect(200);
    await put(created.id, { endDate: '2026-01-01' }).expect(200);
  });

  it.each([
    ['an empty body', {}],
    ['only unknown fields', { ownerId: randomUUID(), taskSeq: 5 }],
  ])('T-PRJ-19 rejects %s', async (_label, body) => {
    const created = await createProject(request, token);
    const res = await put(created.id, body).expect(400);
    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    expect(errorOf(res).details?.[0]?.message).toBe('Provide at least one field to update');
  });

  it('rejects invalid fields on update with their paths', async () => {
    const created = await createProject(request, token);
    const res = await put(created.id, { name: '  ', status: 'DONE' }).expect(400);
    expect(
      errorOf(res)
        .details?.map((detail) => detail.path)
        .sort(),
    ).toEqual(['name', 'status']);
  });

  it('returns 409 CONFLICT on key when the new key is already used, and allows its own key', async () => {
    await createProject(request, token, { key: 'WEB' });
    const other = await createProject(request, token, { key: 'APP' });

    const res = await put(other.id, { key: 'web' }).expect(409);
    expect(errorOf(res).code).toBe('CONFLICT');
    expect(errorOf(res).details?.map((detail) => detail.path)).toEqual(['key']);
    expect((await projectRow(other.id))?.key).toBe('APP');

    await put(other.id, { key: 'APP', name: 'Renamed' }).expect(200);
  });

  it('returns 404 for an unknown uuid and 400 for a non-uuid', async () => {
    expect(errorOf(await put(randomUUID(), { name: 'X' }).expect(404)).code).toBe('NOT_FOUND');
    expect(errorOf(await put('123', { name: 'X' }).expect(400)).code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/projects/:id', () => {
  it('T-PRJ-21 deletes the project and its tasks; GET then returns 404', async () => {
    const doomed = await createProject(request, token);
    const kept = await createProject(request, token, { name: 'Kept' });
    await insertTask(doomed.id);
    await insertTask(doomed.id, 'COMPLETED');
    await insertTask(kept.id);

    const res = await del(doomed.id).expect(204);
    expect(res.text).toBe('');

    expect(await prisma.task.count({ where: { projectId: doomed.id } })).toBe(0);
    expect(await prisma.task.count({ where: { projectId: kept.id } })).toBe(1);
    expect(errorOf(await getOne(doomed.id).expect(404)).code).toBe('NOT_FOUND');
    expect(errorOf(await del(doomed.id).expect(404)).code).toBe('NOT_FOUND');
  });

  it('returns 400 for a non-uuid', async () => {
    expect(errorOf(await del('nope').expect(400)).code).toBe('VALIDATION_ERROR');
  });
});

describe('cross-user access', () => {
  it('T-PRJ-20 update and delete of another user’s project return 404 and change nothing', async () => {
    const theirs = await createProject(request, otherToken, {
      name: 'Their project',
      description: 'Private',
      key: 'SEC',
    });
    await insertTask(theirs.id);
    const before = await projectRow(theirs.id);
    const auditBefore = await auditRows(theirs.id);

    const update = await put(theirs.id, { name: 'Hijacked', status: 'COMPLETED', key: 'OWN' });
    expect(update.status).toBe(404);
    expect(errorOf(update).code).toBe('NOT_FOUND');

    const remove = await del(theirs.id).expect(404);
    expect(errorOf(remove).code).toBe('NOT_FOUND');

    expect(await projectRow(theirs.id)).toEqual(before);
    expect(await prisma.task.count({ where: { projectId: theirs.id } })).toBe(1);
    expect(await auditRows(theirs.id)).toEqual(auditBefore);
  });

  it('a 404 for another user’s project is indistinguishable from a missing one', async () => {
    const theirs = await createProject(request, otherToken);
    const foreign = await getOne(theirs.id).expect(404);
    const missing = await getOne(randomUUID()).expect(404);
    expect(errorOf(foreign).message).toBe(errorOf(missing).message);
  });
});

describe('audit entries', () => {
  it('records CREATED with no changes', async () => {
    const project = await createProject(request, token);
    const rows = await auditRows(project.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId,
      projectId: project.id,
      entityType: 'PROJECT',
      action: 'CREATED',
      changes: null,
    });
  });

  it('records UPDATED with only the changed fields, dates as YYYY-MM-DD', async () => {
    const project = await createProject(request, token, { key: 'WEB', startDate: '2026-10-01' });
    await put(project.id, {
      name: 'Website Redesign',
      status: 'IN_PROGRESS',
      startDate: '2026-10-02',
      key: 'WEB',
    }).expect(200);

    const rows = await auditRows(project.id);
    expect(rows.map((row) => row.action)).toEqual(['CREATED', 'UPDATED']);
    expect(rows[1]).toMatchObject({ userId, projectId: project.id, entityType: 'PROJECT' });
    expect(rows[1]?.changes).toEqual({
      status: { from: 'NOT_STARTED', to: 'IN_PROGRESS' },
      startDate: { from: '2026-10-01', to: '2026-10-02' },
    });
  });

  it('truncates recorded descriptions to 200 characters', async () => {
    const project = await createProject(request, token, { description: 'a'.repeat(300) });
    await put(project.id, { description: 'b'.repeat(250) }).expect(200);

    const [, updated] = await auditRows(project.id);
    expect(updated?.changes).toEqual({
      description: { from: 'a'.repeat(200), to: 'b'.repeat(200) },
    });
    expect((await projectRow(project.id))?.description).toBe('b'.repeat(250));
  });

  it('writes no entry for an update that changes nothing or fails', async () => {
    const project = await createProject(request, token, { status: 'IN_PROGRESS' });
    await put(project.id, { status: 'IN_PROGRESS' }).expect(200);
    await put(project.id, { startDate: '2026-10-10', endDate: '2026-10-01' }).expect(400);
    expect((await auditRows(project.id)).map((row) => row.action)).toEqual(['CREATED']);
  });

  it('records DELETED, and the history outlives the project', async () => {
    const project = await createProject(request, token);
    await del(project.id).expect(204);

    const rows = await auditRows(project.id);
    expect(rows.map((row) => row.action)).toEqual(['CREATED', 'DELETED']);
    // projects → audit_logs is ON DELETE SET NULL (SCHEMA §3).
    expect(rows.every((row) => row.projectId === null)).toBe(true);
    expect(rows[1]).toMatchObject({ userId, entityType: 'PROJECT', changes: null });
  });

  it('rolls the audit entry back with a failed create', async () => {
    await createProject(request, token, { key: 'WEB' });
    await post({ name: 'Dup', key: 'WEB' }).expect(409);
    expect(await prisma.auditLog.count()).toBe(1);
  });
});

describe('authentication', () => {
  it.each([
    ['GET', PROJECTS, undefined],
    ['GET', `${PROJECTS}?limit=0`, undefined],
    ['POST', PROJECTS, { name: 'X' }],
    ['POST', PROJECTS, {}],
    ['GET', projectUrl(randomUUID()), undefined],
    ['GET', projectUrl('not-a-uuid'), undefined],
    ['PUT', projectUrl(randomUUID()), { name: 'X' }],
    ['PUT', projectUrl('not-a-uuid'), {}],
    ['DELETE', projectUrl(randomUUID()), undefined],
  ] as const)(
    'T-PRJ-22 %s %s without a token → 401 UNAUTHENTICATED, before validation (D-031)',
    async (method, url, body) => {
      const call =
        method === 'GET'
          ? request.get(url)
          : method === 'POST'
            ? request.post(url).send(body)
            : method === 'PUT'
              ? request.put(url).send(body)
              : request.delete(url);
      const res = await call.expect(401);
      expect(errorOf(res).code).toBe('UNAUTHENTICATED');
    },
  );

  it('T-PRJ-22 rejects a garbage bearer token with TOKEN_INVALID and writes nothing', async () => {
    const res = await request
      .post(PROJECTS)
      .set('Authorization', bearer('garbage'))
      .send({ name: 'X' })
      .expect(401);
    expect(errorOf(res).code).toBe('TOKEN_INVALID');
    expect(await prisma.project.count()).toBe(0);
  });
});
