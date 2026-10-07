// /api/dashboard integration tests (TEST_PLAN §3.5, T-DSH-01…06) against the real tidyr_test database.
import {
  addDays,
  todayUtc,
  type Dashboard,
  type ListResponse,
  type Project,
  type Task,
} from '@tidyr/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from './helpers/db';
import { createProject, createTask, createUser, loginAs } from './helpers/factories';
import { createClient, dataOf, errorOf, type TestClient } from './helpers/http';

const DASHBOARD = '/api/dashboard';
const bearer = (token: string) => `Bearer ${token}`;

// A fixed "client today", so the overdue and upcoming windows don't depend on when the suite runs.
const TODAY = '2026-10-07';

const DASHBOARD_FIELDS = [
  'completedTasks',
  'inProgressTasks',
  'overdue',
  'overdueTasks',
  'pendingTasks',
  'projectsByStatus',
  'projectsInProgress',
  'tasksByPriority',
  'today',
  'totalProjects',
  'totalTasks',
  'upcoming',
];

let request: TestClient;
let token: string;
let otherToken: string;
let web: Project;

beforeEach(async () => {
  await resetDb();
  request = createClient();
  const [user, other] = await Promise.all([createUser(), createUser()]);
  token = (await loginAs(request, user)).accessToken;
  otherToken = (await loginAs(request, other)).accessToken;
  web = await createProject(request, token, { name: 'Website Redesign', key: 'WEB' });
});

const getDashboard = async (query = `?today=${TODAY}`, as = token) =>
  dataOf<Dashboard>(
    await request.get(`${DASHBOARD}${query}`).set('Authorization', bearer(as)).expect(200),
  );

const task = (overrides: Parameters<typeof createTask>[3] = {}, projectId = web.id, as = token) =>
  createTask(request, as, projectId, overrides);
const keysOf = (tasks: Task[]) => tasks.map((item) => item.key);

describe('GET /api/dashboard', () => {
  it('T-DSH-01 a new user gets all zeros, every enum key, and empty lists', async () => {
    const user = await createUser();
    const freshToken = (await loginAs(request, user)).accessToken;

    const dashboard = await getDashboard(`?today=${TODAY}`, freshToken);

    expect(Object.keys(dashboard).sort()).toEqual(DASHBOARD_FIELDS);
    expect(dashboard).toEqual({
      today: TODAY,
      totalProjects: 0,
      projectsInProgress: 0,
      totalTasks: 0,
      completedTasks: 0,
      pendingTasks: 0,
      inProgressTasks: 0,
      overdueTasks: 0,
      projectsByStatus: { NOT_STARTED: 0, IN_PROGRESS: 0, COMPLETED: 0 },
      tasksByPriority: { LOW: 0, MEDIUM: 0, HIGH: 0 },
      overdue: [],
      upcoming: [],
    });
  });

  it('keeps every enum key when only some have counts', async () => {
    await task({ priority: 'HIGH' });

    const dashboard = await getDashboard();

    expect(dashboard.projectsByStatus).toEqual({ NOT_STARTED: 1, IN_PROGRESS: 0, COMPLETED: 0 });
    expect(dashboard.tasksByPriority).toEqual({ LOW: 0, MEDIUM: 0, HIGH: 1 });
  });

  it('T-DSH-02 counts match the fixture exactly', async () => {
    // 5 projects: 2 not started (incl. WEB), 2 in progress, 1 completed.
    const mobile = await createProject(request, token, { name: 'Mobile', status: 'IN_PROGRESS' });
    await createProject(request, token, { name: 'Ops', status: 'IN_PROGRESS' });
    const docs = await createProject(request, token, { name: 'Docs', status: 'COMPLETED' });
    await createProject(request, token, { name: 'Empty' });

    // 9 tasks: 4 pending, 2 in progress, 3 completed; 2 low, 4 medium, 3 high.
    await task({ status: 'PENDING', priority: 'LOW' });
    await task({ status: 'PENDING', priority: 'MEDIUM' });
    await task({ status: 'IN_PROGRESS', priority: 'HIGH' });
    await task({ status: 'PENDING', priority: 'HIGH' }, mobile.id);
    await task({ status: 'IN_PROGRESS', priority: 'MEDIUM' }, mobile.id);
    await task({ status: 'COMPLETED', priority: 'LOW' }, mobile.id);
    await task({ status: 'COMPLETED', priority: 'MEDIUM' }, docs.id);
    await task({ status: 'COMPLETED', priority: 'HIGH' }, docs.id);
    await task({ status: 'PENDING', priority: 'MEDIUM' }, docs.id);

    const dashboard = await getDashboard();

    expect(dashboard).toMatchObject({
      totalProjects: 5,
      projectsInProgress: 2,
      totalTasks: 9,
      completedTasks: 3,
      pendingTasks: 4,
      inProgressTasks: 2,
      overdueTasks: 0,
      projectsByStatus: { NOT_STARTED: 2, IN_PROGRESS: 2, COMPLETED: 1 },
      tasksByPriority: { LOW: 2, MEDIUM: 4, HIGH: 3 },
    });
    // Pending + In Progress + Completed = Total (D-006).
    expect(dashboard.pendingTasks + dashboard.inProgressTasks + dashboard.completedTasks).toBe(
      dashboard.totalTasks,
    );
  });

  it('reflects updates and deletes on the next request', async () => {
    const created = await task();
    expect((await getDashboard()).pendingTasks).toBe(1);

    await request
      .put(`/api/tasks/${created.id}`)
      .set('Authorization', bearer(token))
      .send({ status: 'COMPLETED' })
      .expect(200);
    expect(await getDashboard()).toMatchObject({ pendingTasks: 0, completedTasks: 1 });

    await request.delete(`/api/projects/${web.id}`).set('Authorization', bearer(token)).expect(204);
    expect(await getDashboard()).toMatchObject({ totalProjects: 0, totalTasks: 0 });
  });

  it('T-DSH-03 overdue follows the `today` param and excludes completed tasks', async () => {
    await task({ name: 'Late', dueDate: addDays(TODAY, -1) });
    await task({ name: 'Late but done', dueDate: addDays(TODAY, -2), status: 'COMPLETED' });
    await task({ name: 'Due today', dueDate: TODAY, status: 'IN_PROGRESS' });
    await task({ name: 'No date' });

    const today = await getDashboard(`?today=${TODAY}`);
    expect(today.today).toBe(TODAY);
    expect(today.overdueTasks).toBe(1);
    expect(today.overdue.map((item) => item.name)).toEqual(['Late']);

    // A client a day ahead (e.g. east of UTC) sees the task due "today" as overdue too.
    const tomorrow = await getDashboard(`?today=${addDays(TODAY, 1)}`);
    expect(tomorrow.today).toBe(addDays(TODAY, 1));
    expect(tomorrow.overdueTasks).toBe(2);
    expect(tomorrow.overdue.map((item) => item.name)).toEqual(['Late', 'Due today']);

    // The count agrees with the list the dashboard card links to.
    const list = await request
      .get(`/api/tasks?due=overdue&today=${addDays(TODAY, 1)}`)
      .set('Authorization', bearer(token))
      .expect(200);
    expect((list.body as ListResponse<Task>).meta.total).toBe(tomorrow.overdueTasks);
  });

  it('defaults `today` to the server’s UTC date', async () => {
    await task({ name: 'Yesterday', dueDate: addDays(todayUtc(), -1) });

    const dashboard = await getDashboard('');

    expect(dashboard.today).toBe(todayUtc());
    expect(dashboard.overdueTasks).toBe(1);
  });

  it('T-DSH-04 never counts another user’s data', async () => {
    const theirs = await createProject(request, otherToken, {
      name: 'Theirs',
      status: 'IN_PROGRESS',
    });
    await task({ dueDate: addDays(TODAY, -3), priority: 'HIGH' }, theirs.id, otherToken);
    await task({ dueDate: addDays(TODAY, 2), status: 'COMPLETED' }, theirs.id, otherToken);
    await task({ dueDate: addDays(TODAY, 1) }, theirs.id, otherToken);
    await task({ name: 'Mine', dueDate: addDays(TODAY, 1), priority: 'LOW' });

    const mine = await getDashboard();

    expect(mine).toMatchObject({
      totalProjects: 1,
      projectsInProgress: 0,
      totalTasks: 1,
      completedTasks: 0,
      pendingTasks: 1,
      inProgressTasks: 0,
      overdueTasks: 0,
      projectsByStatus: { NOT_STARTED: 1, IN_PROGRESS: 0, COMPLETED: 0 },
      tasksByPriority: { LOW: 1, MEDIUM: 0, HIGH: 0 },
      overdue: [],
    });
    expect(mine.upcoming.map((item) => item.name)).toEqual(['Mine']);

    const theirsDashboard = await getDashboard(`?today=${TODAY}`, otherToken);
    expect(theirsDashboard).toMatchObject({ totalProjects: 1, totalTasks: 3, overdueTasks: 1 });
  });

  it('T-DSH-05 lists at most 5 overdue (oldest first) and 5 upcoming (soonest first), never completed', async () => {
    // 7 overdue, created out of order, plus a completed one that's the oldest of all.
    for (const days of [-4, -1, -7, -2, -6, -3, -5]) {
      await task({ name: `Overdue ${-days}`, dueDate: addDays(TODAY, days) });
    }
    await task({ name: 'Done long ago', dueDate: addDays(TODAY, -30), status: 'COMPLETED' });
    // 7 upcoming including one due today, plus a completed one due today and one with no date.
    for (const days of [3, 0, 6, 1, 5, 2, 4]) {
      await task({ name: `Upcoming ${days}`, dueDate: addDays(TODAY, days) });
    }
    await task({ name: 'Done today', dueDate: TODAY, status: 'COMPLETED' });
    await task({ name: 'Someday' });

    const dashboard = await getDashboard();

    // The count isn't capped, only the list is.
    expect(dashboard.overdueTasks).toBe(7);
    expect(dashboard.overdue.map((item) => item.name)).toEqual([
      'Overdue 7',
      'Overdue 6',
      'Overdue 5',
      'Overdue 4',
      'Overdue 3',
    ]);
    expect(dashboard.upcoming.map((item) => item.name)).toEqual([
      'Upcoming 0',
      'Upcoming 1',
      'Upcoming 2',
      'Upcoming 3',
      'Upcoming 4',
    ]);
    for (const item of [...dashboard.overdue, ...dashboard.upcoming]) {
      expect(item.status).not.toBe('COMPLETED');
    }
    expect(dashboard.overdue.every((item) => (item.dueDate ?? '') < TODAY)).toBe(true);
    expect(dashboard.upcoming.every((item) => (item.dueDate ?? '') >= TODAY)).toBe(true);
  });

  it('returns full task DTOs and breaks same-day ties by priority', async () => {
    const low = await task({ name: 'Low', priority: 'LOW', dueDate: addDays(TODAY, 1) });
    const high = await task({ name: 'High', priority: 'HIGH', dueDate: addDays(TODAY, 1) });

    const dashboard = await getDashboard();

    expect(keysOf(dashboard.upcoming)).toEqual([high.key, low.key]);
    expect(dashboard.upcoming[0]).toEqual(high);
    expect(dashboard.upcoming[0]?.project).toEqual({
      id: web.id,
      key: 'WEB',
      name: 'Website Redesign',
    });
  });

  it.each([
    ['an impossible date', '2026-02-30'],
    ['a short date', '2026-1-1'],
    ['a timestamp', '2026-10-07T00:00:00Z'],
    ['a word', 'tomorrow'],
    ['an empty value', ''],
  ])('T-DSH-06 rejects %s as `today` with 400', async (_label, value) => {
    const res = await request
      .get(`${DASHBOARD}?today=${encodeURIComponent(value)}`)
      .set('Authorization', bearer(token))
      .expect(400);

    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    expect(errorOf(res).details?.map((detail) => detail.path)).toEqual(['today']);
  });

  it('requires a token, before validating the query (D-031)', async () => {
    for (const url of [DASHBOARD, `${DASHBOARD}?today=nope`]) {
      const res = await request.get(url).expect(401);
      expect(errorOf(res).code).toBe('UNAUTHENTICATED');
    }
    const garbage = await request
      .get(DASHBOARD)
      .set('Authorization', bearer('garbage'))
      .expect(401);
    expect(errorOf(garbage).code).toBe('TOKEN_INVALID');
  });
});
