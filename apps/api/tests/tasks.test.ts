// /api/tasks integration tests (TEST_PLAN §3.4, T-TSK-01…28) against the real tidyr_test database.
import { randomUUID } from 'node:crypto';
import {
  addDays,
  todayUtc,
  type ListResponse,
  type Project,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '@tidyr/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { resetDb } from './helpers/db';
import { createProject, createTask, createUser, loginAs } from './helpers/factories';
import { createClient, dataOf, errorOf, type TestClient } from './helpers/http';

const TASKS = '/api/tasks';
const taskUrl = (id: string) => `${TASKS}/${id}`;
const bearer = (token: string) => `Bearer ${token}`;

// A fixed "client today", so the due filters don't depend on when the suite runs.
const TODAY = '2026-10-07';

const TASK_FIELDS = [
  'completedAt',
  'createdAt',
  'description',
  'dueDate',
  'id',
  'key',
  'name',
  'number',
  'priority',
  'project',
  'projectId',
  'status',
  'updatedAt',
];

let request: TestClient;
let token: string;
let otherToken: string;
let userId: string;
let web: Project;

beforeEach(async () => {
  await resetDb();
  request = createClient();
  const [user, other] = await Promise.all([createUser(), createUser()]);
  userId = user.id;
  token = (await loginAs(request, user)).accessToken;
  otherToken = (await loginAs(request, other)).accessToken;
  web = await createProject(request, token, { name: 'Website Redesign', key: 'WEB' });
});

const post = (body: unknown, as = token) =>
  request
    .post(TASKS)
    .set('Authorization', bearer(as))
    .send(body as object);
const put = (id: string, body: unknown, as = token) =>
  request
    .put(taskUrl(id))
    .set('Authorization', bearer(as))
    .send(body as object);
const getOne = (id: string, as = token) =>
  request.get(taskUrl(id)).set('Authorization', bearer(as));
const del = (id: string, as = token) =>
  request.delete(taskUrl(id)).set('Authorization', bearer(as));
const listTasks = async (query = '', as = token) => {
  const res = await request.get(`${TASKS}${query}`).set('Authorization', bearer(as)).expect(200);
  return res.body as ListResponse<Task>;
};
const keysOf = (list: ListResponse<Task>) => list.data.map((task) => task.key);
const sorted = (keys: string[]) => [...keys].sort();

const task = (overrides: Parameters<typeof createTask>[3] = {}, projectId = web.id, as = token) =>
  createTask(request, as, projectId, overrides);
const taskRow = (id: string) => prisma.task.findUnique({ where: { id } });
const taskSeqOf = async (projectId: string) =>
  (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).taskSeq;
const auditRows = (entityId: string) =>
  prisma.auditLog.findMany({ where: { entityId }, orderBy: { createdAt: 'asc' } });

/** Creates one task per entry in order, so WEB-1 is the first entry. */
async function seedTasks(
  entries: Array<{
    name?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string | null;
  }>,
  projectId = web.id,
  as = token,
): Promise<Task[]> {
  const created: Task[] = [];
  for (const [index, entry] of entries.entries()) {
    created.push(await task({ name: `Task ${index + 1}`, ...entry }, projectId, as));
  }
  return created;
}

describe('POST /api/tasks', () => {
  it('T-TSK-01 creates with only projectId and name: PENDING, MEDIUM, key KEY-1', async () => {
    const res = await post({ projectId: web.id, name: 'Design hero section' }).expect(201);
    const created = dataOf<Task>(res);

    expect(Object.keys(created).sort()).toEqual(TASK_FIELDS);
    expect(created).toMatchObject({
      key: 'WEB-1',
      number: 1,
      projectId: web.id,
      project: { id: web.id, key: 'WEB', name: 'Website Redesign' },
      name: 'Design hero section',
      description: null,
      priority: 'MEDIUM',
      status: 'PENDING',
      dueDate: null,
      completedAt: null,
    });
    expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);
  });

  it('creates with all fields; trims the name; dueDate echoes as YYYY-MM-DD', async () => {
    const res = await post({
      projectId: web.id,
      name: '  Design hero section  ',
      description: 'Use new brand colors',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      dueDate: '2026-10-20',
    }).expect(201);

    expect(dataOf<Task>(res)).toMatchObject({
      name: 'Design hero section',
      description: 'Use new brand colors',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      dueDate: '2026-10-20',
      completedAt: null,
    });
  });

  it('stores an empty description as null and ignores fields clients may not set', async () => {
    const foreignId = randomUUID();
    const res = await post({
      projectId: web.id,
      name: 'Hero',
      description: '  ',
      id: foreignId,
      number: 42,
      completedAt: '2020-01-01T00:00:00.000Z',
    }).expect(201);
    const created = dataOf<Task>(res);

    expect(created).toMatchObject({
      number: 1,
      key: 'WEB-1',
      description: null,
      completedAt: null,
    });
    expect(created.id).not.toBe(foreignId);
  });

  it('T-TSK-02 numbers tasks 1, 2, 3 and never reuses a number after a delete', async () => {
    const first = await task();
    const second = await task();
    const third = await task();
    expect([first.key, second.key, third.key]).toEqual(['WEB-1', 'WEB-2', 'WEB-3']);

    await del(third.id).expect(204);
    await del(first.id).expect(204);
    const fourth = await task();
    expect(fourth).toMatchObject({ number: 4, key: 'WEB-4' });
    expect(await taskSeqOf(web.id)).toBe(4);
  });

  it('numbers each project separately', async () => {
    const mobile = await createProject(request, token, { name: 'Mobile', key: 'MOB' });
    await task();
    await task();
    expect((await task({}, mobile.id)).key).toBe('MOB-1');
  });

  it('T-TSK-03 gives 5 concurrent creates the numbers 1–5 exactly once', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, index) => post({ projectId: web.id, name: `Task ${index}` })),
    );

    expect(results.map((res) => res.status)).toEqual([201, 201, 201, 201, 201]);
    const numbers = results.map((res) => dataOf<Task>(res).number).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5]);
    expect(await taskSeqOf(web.id)).toBe(5);
    expect(await prisma.task.count({ where: { projectId: web.id } })).toBe(5);
  });

  it('T-TSK-04 returns 404 in another user’s project: no task, their taskSeq unchanged', async () => {
    const theirs = await createProject(request, otherToken, { name: 'Theirs', key: 'SEC' });

    const res = await post({ projectId: theirs.id, name: 'Sneaky' }).expect(404);

    expect(errorOf(res).code).toBe('NOT_FOUND');
    expect(await prisma.task.count()).toBe(0);
    expect(await taskSeqOf(theirs.id)).toBe(0);
    expect(await prisma.auditLog.count({ where: { entityType: 'TASK' } })).toBe(0);
  });

  it('T-TSK-05 returns 404 for a project that doesn’t exist', async () => {
    const res = await post({ projectId: randomUUID(), name: 'Orphan' }).expect(404);
    expect(errorOf(res).code).toBe('NOT_FOUND');
    expect(await prisma.task.count()).toBe(0);
  });

  it.each([
    ['an invalid priority', { priority: 'URGENT' }, 'priority'],
    ['a lowercase priority', { priority: 'high' }, 'priority'],
    ['an invalid status', { status: 'DONE' }, 'status'],
    ['an impossible dueDate', { dueDate: '2026-02-30' }, 'dueDate'],
    ['a dueDate in another format', { dueDate: '10/20/2026' }, 'dueDate'],
    ['an empty name', { name: '' }, 'name'],
    ['a whitespace-only name', { name: '   ' }, 'name'],
    ['a 201-character name', { name: 'x'.repeat(201) }, 'name'],
    ['a missing name', { name: undefined }, 'name'],
    ['a missing projectId', { projectId: undefined }, 'projectId'],
    ['a non-uuid projectId', { projectId: 'web' }, 'projectId'],
    ['a 5001-character description', { description: 'x'.repeat(5001) }, 'description'],
  ])('T-TSK-06 rejects %s with 400 on that field', async (_label, override, path) => {
    const res = await post({ projectId: web.id, name: 'Valid', ...override }).expect(400);

    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    expect(errorOf(res).details?.map((detail) => detail.path)).toEqual([path]);
    expect(await prisma.task.count()).toBe(0);
    expect(await taskSeqOf(web.id)).toBe(0);
  });

  it('T-TSK-07 sets completedAt when created as COMPLETED', async () => {
    const before = Date.now();
    const created = await task({ status: 'COMPLETED' });

    expect(created.completedAt).not.toBeNull();
    const completedAt = new Date(created.completedAt ?? '').getTime();
    expect(completedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(completedAt).toBeLessThanOrEqual(Date.now() + 1000);
  });
});

describe('GET /api/tasks', () => {
  it('T-TSK-08 lists only the caller’s tasks, across all their projects', async () => {
    const mobile = await createProject(request, token, { name: 'Mobile', key: 'MOB' });
    const theirs = await createProject(request, otherToken, { name: 'Theirs', key: 'WEB' });
    await task();
    await task({}, mobile.id);
    await task({}, theirs.id, otherToken);

    const list = await listTasks();

    expect(sorted(keysOf(list))).toEqual(['MOB-1', 'WEB-1']);
    expect(list.meta.total).toBe(2);
    expect(list.data.every((item) => item.projectId !== theirs.id)).toBe(true);
  });

  it('restricts to one project with projectId', async () => {
    const mobile = await createProject(request, token, { name: 'Mobile', key: 'MOB' });
    await task();
    await task({}, mobile.id);

    expect(keysOf(await listTasks(`?projectId=${mobile.id}`))).toEqual(['MOB-1']);
  });

  it('T-TSK-09 returns an empty list for another user’s projectId (or an unknown one)', async () => {
    const theirs = await createProject(request, otherToken, { name: 'Theirs', key: 'SEC' });
    await task({}, theirs.id, otherToken);
    await task();

    for (const projectId of [theirs.id, randomUUID()]) {
      const list = await listTasks(`?projectId=${projectId}`);
      expect(list.data).toEqual([]);
      expect(list.meta).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
    }
  });

  it('rejects a non-uuid projectId', async () => {
    const res = await request
      .get(`${TASKS}?projectId=web`)
      .set('Authorization', bearer(token))
      .expect(400);
    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    expect(errorOf(res).details?.[0]?.path).toBe('projectId');
  });

  it('T-TSK-10 search is a case-insensitive "contains" on name', async () => {
    await seedTasks([
      { name: 'Design HERO section' },
      { name: 'Superhero copy' },
      { name: 'Footer' },
    ]);

    expect(sorted(keysOf(await listTasks('?search=hero')))).toEqual(['WEB-1', 'WEB-2']);
    expect(keysOf(await listTasks('?search=%20%20footer%20'))).toEqual(['WEB-3']);
    expect(keysOf(await listTasks('?search=nothing'))).toEqual([]);
  });

  it('treats LIKE wildcards in a search literally', async () => {
    await seedTasks([{ name: '100% done' }, { name: 'snake_case names' }, { name: 'Plain' }]);

    expect(keysOf(await listTasks('?search=%25'))).toEqual(['WEB-1']);
    expect(keysOf(await listTasks('?search=_'))).toEqual(['WEB-2']);
  });

  it('T-TSK-11 search by key "web-2" finds that task (any case), never another user’s', async () => {
    await seedTasks([{ name: 'First' }, { name: 'Second' }, { name: 'Third' }]);
    const theirs = await createProject(request, otherToken, { name: 'Theirs', key: 'WEB' });
    await seedTasks([{ name: 'Their first' }, { name: 'Their second' }], theirs.id, otherToken);

    for (const search of ['web-2', 'WEB-2', 'Web-2', '%20web-2%20']) {
      const list = await listTasks(`?search=${search}`);
      expect(list.data.map((item) => item.name)).toEqual(['Second']);
    }
    expect(keysOf(await listTasks('?search=web-9'))).toEqual([]);
    expect(keysOf(await listTasks('?search=mob-2'))).toEqual([]);
  });

  it('a key-shaped search also matches names, and a huge number is not an error', async () => {
    const mobile = await createProject(request, token, { name: 'Mobile', key: 'MOB' });
    await seedTasks([{ name: 'First' }, { name: 'Second' }]);
    const named = await task({ name: 'Follow up on web-2 feedback' }, mobile.id);

    expect(sorted(keysOf(await listTasks('?search=web-2')))).toEqual([named.key, 'WEB-2'].sort());
    expect(keysOf(await listTasks('?search=web-99999999999'))).toEqual([]);
    expect(keysOf(await listTasks('?search=web-2147483648'))).toEqual([]);
  });

  it('T-TSK-12 filters by one or several statuses', async () => {
    await seedTasks([{ status: 'PENDING' }, { status: 'IN_PROGRESS' }, { status: 'COMPLETED' }]);

    expect(keysOf(await listTasks('?status=COMPLETED'))).toEqual(['WEB-3']);
    expect(sorted(keysOf(await listTasks('?status=PENDING,IN_PROGRESS')))).toEqual([
      'WEB-1',
      'WEB-2',
    ]);
  });

  it('T-TSK-13 combines a multi-value priority filter with a status filter', async () => {
    await seedTasks([
      { priority: 'HIGH', status: 'PENDING' },
      { priority: 'HIGH', status: 'COMPLETED' },
      { priority: 'LOW', status: 'PENDING' },
      { priority: 'MEDIUM', status: 'PENDING' },
      { priority: 'LOW', status: 'IN_PROGRESS' },
    ]);

    expect(sorted(keysOf(await listTasks('?priority=HIGH,LOW')))).toEqual([
      'WEB-1',
      'WEB-2',
      'WEB-3',
      'WEB-5',
    ]);
    expect(sorted(keysOf(await listTasks('?priority=HIGH,LOW&status=PENDING')))).toEqual([
      'WEB-1',
      'WEB-3',
    ]);
  });

  it('T-TSK-14 due=overdue is before `today` and not completed', async () => {
    await seedTasks([
      { dueDate: addDays(TODAY, -3), status: 'PENDING' },
      { dueDate: addDays(TODAY, -1), status: 'IN_PROGRESS' },
      { dueDate: addDays(TODAY, -2), status: 'COMPLETED' },
      { dueDate: TODAY, status: 'PENDING' },
      { dueDate: null, status: 'PENDING' },
    ]);

    const overdue = await listTasks(`?due=overdue&today=${TODAY}`);
    expect(sorted(keysOf(overdue))).toEqual(['WEB-1', 'WEB-2']);

    // The client's `today` decides: a day later, the task due today is overdue too.
    const tomorrow = await listTasks(`?due=overdue&today=${addDays(TODAY, 1)}`);
    expect(sorted(keysOf(tomorrow))).toEqual(['WEB-1', 'WEB-2', 'WEB-4']);

    // The overdue rule's own status check doesn't override an explicit status filter.
    expect(keysOf(await listTasks(`?due=overdue&today=${TODAY}&status=COMPLETED`))).toEqual([]);
    expect(keysOf(await listTasks(`?due=overdue&today=${TODAY}&status=IN_PROGRESS`))).toEqual([
      'WEB-2',
    ]);
  });

  it('T-TSK-15 due=today, due=week (today … today+6) and due=none', async () => {
    await seedTasks([
      { dueDate: addDays(TODAY, -1) },
      { dueDate: TODAY },
      { dueDate: addDays(TODAY, 6) },
      { dueDate: addDays(TODAY, 7) },
      { dueDate: null },
      { dueDate: TODAY, status: 'COMPLETED' },
    ]);

    expect(sorted(keysOf(await listTasks(`?due=today&today=${TODAY}`)))).toEqual([
      'WEB-2',
      'WEB-6',
    ]);
    expect(sorted(keysOf(await listTasks(`?due=week&today=${TODAY}`)))).toEqual([
      'WEB-2',
      'WEB-3',
      'WEB-6',
    ]);
    expect(keysOf(await listTasks(`?due=none&today=${TODAY}`))).toEqual(['WEB-5']);
  });

  it('defaults `today` to the server’s UTC date', async () => {
    await seedTasks([{ dueDate: todayUtc() }, { dueDate: addDays(todayUtc(), 1) }]);
    expect(keysOf(await listTasks('?due=today'))).toEqual(['WEB-1']);
  });

  it('T-TSK-16 sorts by priority in enum order: desc puts HIGH first', async () => {
    await seedTasks([{ priority: 'MEDIUM' }, { priority: 'LOW' }, { priority: 'HIGH' }]);

    const desc = await listTasks('?sort=priority&order=desc');
    expect(desc.data.map((item) => item.priority)).toEqual(['HIGH', 'MEDIUM', 'LOW']);
    const asc = await listTasks('?sort=priority&order=asc');
    expect(asc.data.map((item) => item.priority)).toEqual(['LOW', 'MEDIUM', 'HIGH']);
  });

  it('T-TSK-17 sorts by dueDate with nulls last in both directions', async () => {
    await seedTasks([
      { dueDate: null },
      { dueDate: '2026-10-20' },
      { dueDate: '2026-10-05' },
      { dueDate: null },
      { dueDate: '2026-10-12' },
    ]);

    const asc = await listTasks('?sort=dueDate&order=asc');
    expect(asc.data.map((item) => item.dueDate)).toEqual([
      '2026-10-05',
      '2026-10-12',
      '2026-10-20',
      null,
      null,
    ]);
    const desc = await listTasks('?sort=dueDate&order=desc');
    expect(desc.data.map((item) => item.dueDate)).toEqual([
      '2026-10-20',
      '2026-10-12',
      '2026-10-05',
      null,
      null,
    ]);
  });

  it('sorts by name, and by createdAt desc by default', async () => {
    const created = await seedTasks([{ name: 'Bravo' }, { name: 'Alpha' }, { name: 'Charlie' }]);
    // Spread the creation times so the default order can't depend on millisecond ties.
    for (const [index, item] of created.entries()) {
      await prisma.task.update({
        where: { id: item.id },
        data: { createdAt: new Date(Date.UTC(2026, 0, 1 + index)) },
      });
    }

    expect(keysOf(await listTasks())).toEqual(['WEB-3', 'WEB-2', 'WEB-1']);
    expect(keysOf(await listTasks('?sort=createdAt&order=asc'))).toEqual([
      'WEB-1',
      'WEB-2',
      'WEB-3',
    ]);
    const byName = await listTasks('?sort=name&order=asc');
    expect(byName.data.map((item) => item.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('T-TSK-18 paginates with real meta, including past the last page', async () => {
    await seedTasks([{}, {}, {}, {}, {}]);

    const first = await listTasks('?limit=2&sort=name&order=asc');
    expect(first.meta).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
    expect(first.data.map((item) => item.name)).toEqual(['Task 1', 'Task 2']);

    const last = await listTasks('?limit=2&page=3&sort=name&order=asc');
    expect(last.data.map((item) => item.name)).toEqual(['Task 5']);

    const past = await listTasks('?limit=2&page=4');
    expect(past.data).toEqual([]);
    expect(past.meta).toEqual({ page: 4, limit: 2, total: 5, totalPages: 3 });
  });

  it('T-TSK-26 treats an SQL-injection-like search as text: 200, empty, table intact', async () => {
    await seedTasks([{}, {}]);
    const search = encodeURIComponent("'; DROP TABLE tasks;--");

    const list = await listTasks(`?search=${search}`);

    expect(list.data).toEqual([]);
    expect(list.meta.total).toBe(0);
    expect(await prisma.task.count()).toBe(2);
    expect((await listTasks()).meta.total).toBe(2);
  });

  it.each([
    ['status=DONE', 'status'],
    ['status=pending', 'status'],
    ['priority=URGENT', 'priority'],
    ['due=later', 'due'],
    ['sort=key', 'sort'],
    ['order=up', 'order'],
    ['today=2026-02-30', 'today'],
    ['limit=101', 'limit'],
    ['page=0', 'page'],
  ])('T-TSK-27 rejects an invalid query value (%s) with 400', async (query, path) => {
    const res = await request
      .get(`${TASKS}?${query}`)
      .set('Authorization', bearer(token))
      .expect(400);
    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    // CSV enum lists report the offending item, e.g. `status.0`.
    expect(errorOf(res).details?.[0]?.path.split('.')[0]).toBe(path);
  });
});

describe('GET /api/tasks/:id', () => {
  it('T-TSK-19 returns the caller’s task with its key and project summary', async () => {
    const created = await task({ name: 'Hero', dueDate: '2026-10-20' });

    const res = await getOne(created.id).expect(200);
    const fetched = dataOf<Task>(res);

    expect(Object.keys(fetched).sort()).toEqual(TASK_FIELDS);
    expect(fetched).toEqual(created);
    expect(fetched).toMatchObject({
      key: 'WEB-1',
      project: { id: web.id, key: 'WEB', name: 'Website Redesign' },
      dueDate: '2026-10-20',
    });
  });

  it('the key follows a project key change', async () => {
    const created = await task();
    await request
      .put(`/api/projects/${web.id}`)
      .set('Authorization', bearer(token))
      .send({ key: 'SITE' })
      .expect(200);

    expect(dataOf<Task>(await getOne(created.id).expect(200)).key).toBe('SITE-1');
  });

  it('returns 404 for an unknown uuid and 400 for a non-uuid', async () => {
    const missing = await getOne(randomUUID()).expect(404);
    expect(errorOf(missing).code).toBe('NOT_FOUND');
    const invalid = await getOne('WEB-1').expect(400);
    expect(errorOf(invalid).code).toBe('VALIDATION_ERROR');
    expect(errorOf(invalid).details?.[0]?.path).toBe('id');
  });
});

describe('PUT /api/tasks/:id', () => {
  it('applies a partial update and leaves the other fields unchanged', async () => {
    const created = await task({
      name: 'Hero',
      description: 'Keep me',
      priority: 'LOW',
      dueDate: '2026-10-20',
    });

    const res = await put(created.id, { priority: 'HIGH' }).expect(200);

    expect(dataOf<Task>(res)).toEqual({
      ...created,
      priority: 'HIGH',
      updatedAt: dataOf<Task>(res).updatedAt,
    });
  });

  it('T-TSK-21 COMPLETED sets completedAt (kept on repeat); leaving COMPLETED clears it', async () => {
    const created = await task();

    const completed = dataOf<Task>(await put(created.id, { status: 'COMPLETED' }).expect(200));
    expect(completed.completedAt).not.toBeNull();

    const again = dataOf<Task>(await put(created.id, { status: 'COMPLETED' }).expect(200));
    expect(again.completedAt).toBe(completed.completedAt);

    const renamed = dataOf<Task>(await put(created.id, { name: 'Renamed' }).expect(200));
    expect(renamed.completedAt).toBe(completed.completedAt);

    const reopened = dataOf<Task>(await put(created.id, { status: 'PENDING' }).expect(200));
    expect(reopened.completedAt).toBeNull();

    await put(created.id, { status: 'COMPLETED' }).expect(200);
    const inProgress = dataOf<Task>(await put(created.id, { status: 'IN_PROGRESS' }).expect(200));
    expect(inProgress.completedAt).toBeNull();
  });

  it('T-TSK-22 ignores projectId in the body: the task stays in its project', async () => {
    const mobile = await createProject(request, token, { name: 'Mobile', key: 'MOB' });
    const created = await task();

    const res = await put(created.id, { projectId: mobile.id, name: 'Moved?' }).expect(200);

    expect(dataOf<Task>(res)).toMatchObject({ projectId: web.id, key: 'WEB-1', name: 'Moved?' });
    expect((await taskRow(created.id))?.projectId).toBe(web.id);
    expect(await taskSeqOf(mobile.id)).toBe(0);
  });

  it.each([
    ['{}', {}],
    ['only projectId', { projectId: randomUUID() }],
    ['only fields clients may not set', { number: 7, completedAt: null, id: randomUUID() }],
  ])('T-TSK-23 rejects an update with no updatable field (%s) with 400', async (_label, body) => {
    const created = await task();

    const res = await put(created.id, body).expect(400);

    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    expect(await taskRow(created.id)).toMatchObject({ number: 1, projectId: web.id });
  });

  it('T-TSK-24 clears dueDate and description with null', async () => {
    const created = await task({ dueDate: '2026-10-20', description: 'Details' });

    const res = await put(created.id, { dueDate: null, description: null }).expect(200);

    expect(dataOf<Task>(res)).toMatchObject({ dueDate: null, description: null });
    expect(await taskRow(created.id)).toMatchObject({ dueDate: null, description: null });
  });

  it('rejects invalid fields with their paths and changes nothing', async () => {
    const created = await task();

    const res = await put(created.id, {
      name: '',
      status: 'DONE',
      priority: 'URGENT',
      dueDate: '2026-13-01',
    }).expect(400);

    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    expect(
      errorOf(res)
        .details?.map((detail) => detail.path)
        .sort(),
    ).toEqual(['dueDate', 'name', 'priority', 'status']);
    expect(dataOf<Task>(await getOne(created.id))).toEqual(created);
  });

  it('returns 404 for an unknown uuid and 400 for a non-uuid', async () => {
    const missing = await put(randomUUID(), { name: 'X' }).expect(404);
    expect(errorOf(missing).code).toBe('NOT_FOUND');
    const invalid = await put('nope', { name: 'X' }).expect(400);
    expect(errorOf(invalid).code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('T-TSK-25 deletes the caller’s task: 204, then GET is 404 and the counts drop', async () => {
    const kept = await task();
    const doomed = await task();

    const res = await del(doomed.id).expect(204);
    expect(res.text).toBe('');

    expect(errorOf(await getOne(doomed.id).expect(404)).code).toBe('NOT_FOUND');
    expect(errorOf(await del(doomed.id).expect(404)).code).toBe('NOT_FOUND');
    await getOne(kept.id).expect(200);
    const project = await request
      .get(`/api/projects/${web.id}`)
      .set('Authorization', bearer(token))
      .expect(200);
    expect(dataOf<Project>(project).taskCounts.total).toBe(1);
  });

  it('returns 400 for a non-uuid', async () => {
    expect(errorOf(await del('WEB-1').expect(400)).code).toBe('VALIDATION_ERROR');
  });
});

describe('cross-user access', () => {
  it('T-TSK-20 get, update and delete of another user’s task return 404 and change nothing', async () => {
    const theirs = await createProject(request, otherToken, { name: 'Theirs', key: 'SEC' });
    const theirTask = await task({ name: 'Private', priority: 'HIGH' }, theirs.id, otherToken);
    const rowBefore = await taskRow(theirTask.id);
    const auditBefore = await auditRows(theirTask.id);

    for (const res of [
      await getOne(theirTask.id),
      await put(theirTask.id, { name: 'Hijacked', status: 'COMPLETED', priority: 'LOW' }),
      await del(theirTask.id),
    ]) {
      expect(res.status).toBe(404);
      expect(errorOf(res).code).toBe('NOT_FOUND');
    }

    expect(await taskRow(theirTask.id)).toEqual(rowBefore);
    expect(await auditRows(theirTask.id)).toEqual(auditBefore);
    const stillTheirs = await getOne(theirTask.id, otherToken).expect(200);
    expect(dataOf<Task>(stillTheirs)).toEqual(theirTask);
  });

  it('a 404 for another user’s task is indistinguishable from a missing one', async () => {
    const theirs = await createProject(request, otherToken, { name: 'Theirs', key: 'SEC' });
    const theirTask = await task({}, theirs.id, otherToken);

    const forbidden = await getOne(theirTask.id).expect(404);
    const missing = await getOne(randomUUID()).expect(404);
    expect(forbidden.body).toEqual(missing.body);
  });
});

describe('audit entries', () => {
  it('records CREATED with no changes, scoped to the task’s project', async () => {
    const created = await task();

    const rows = await auditRows(created.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId,
      projectId: web.id,
      entityType: 'TASK',
      action: 'CREATED',
      changes: null,
    });
  });

  it('records UPDATED with only the changed fields, dates as YYYY-MM-DD', async () => {
    const created = await task({ name: 'Hero', dueDate: '2026-10-20' });

    await put(created.id, { status: 'COMPLETED', dueDate: '2026-10-25', name: 'Hero' }).expect(200);

    const rows = await auditRows(created.id);
    expect(rows.map((row) => row.action)).toEqual(['CREATED', 'UPDATED']);
    expect(rows[1]?.projectId).toBe(web.id);
    expect(rows[1]?.changes).toEqual({
      status: { from: 'PENDING', to: 'COMPLETED' },
      dueDate: { from: '2026-10-20', to: '2026-10-25' },
    });
  });

  it('writes no entry for an update that changes nothing', async () => {
    const created = await task({ name: 'Hero', priority: 'HIGH' });

    await put(created.id, { name: 'Hero', priority: 'HIGH' }).expect(200);

    expect((await auditRows(created.id)).map((row) => row.action)).toEqual(['CREATED']);
  });

  it('records DELETED, and the history outlives the task', async () => {
    const created = await task();

    await del(created.id).expect(204);

    const rows = await auditRows(created.id);
    expect(rows.map((row) => row.action)).toEqual(['CREATED', 'DELETED']);
    expect(rows[1]).toMatchObject({ projectId: web.id, changes: null });
  });
});

describe('authentication', () => {
  const id = randomUUID();
  it.each([
    ['GET', TASKS, undefined],
    ['GET', `${TASKS}?status=DONE`, undefined],
    ['POST', TASKS, {}],
    ['GET', taskUrl('not-a-uuid'), undefined],
    ['PUT', taskUrl(id), {}],
    ['PUT', taskUrl('not-a-uuid'), { name: 'X' }],
    ['DELETE', taskUrl(id), undefined],
  ])(
    'T-TSK-28 %s %s without a token → 401 UNAUTHENTICATED, before validation (D-031)',
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

  it('T-TSK-28 rejects a garbage bearer token with TOKEN_INVALID and writes nothing', async () => {
    const res = await request
      .post(TASKS)
      .set('Authorization', bearer('garbage'))
      .send({ projectId: web.id, name: 'X' })
      .expect(401);
    expect(errorOf(res).code).toBe('TOKEN_INVALID');
    expect(await prisma.task.count()).toBe(0);
  });
});
