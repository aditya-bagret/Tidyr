// Activity endpoints (API_CONTRACT §8, TEST_PLAN §3.5, T-ACT-01…05) against the real tidyr_test database.
import { randomUUID } from 'node:crypto';
import type { ActivityEntry, ListResponse, Project, Task } from '@tidyr/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { resetDb } from './helpers/db';
import { createProject, createTask, createUser, loginAs } from './helpers/factories';
import { createClient, errorOf, type TestClient } from './helpers/http';

const projectActivityUrl = (id: string) => `/api/projects/${id}/activity`;
const taskActivityUrl = (id: string) => `/api/tasks/${id}/activity`;
const bearer = (token: string) => `Bearer ${token}`;

const ENTRY_FIELDS = ['action', 'changes', 'createdAt', 'entityId', 'entityType', 'id'];

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

const fetchActivity = (url: string, as = token) =>
  request.get(url).set('Authorization', bearer(as));
const activityOf = async (url: string, as = token) =>
  (await fetchActivity(url, as).expect(200)).body as ListResponse<ActivityEntry>;
const projectActivity = (id = web.id, query = '') =>
  activityOf(`${projectActivityUrl(id)}${query}`);
const taskActivity = (id: string) => activityOf(taskActivityUrl(id));

const task = (overrides: Parameters<typeof createTask>[3] = {}, projectId = web.id, as = token) =>
  createTask(request, as, projectId, overrides);
const updateTask = (id: string, body: object) =>
  request.put(`/api/tasks/${id}`).set('Authorization', bearer(token)).send(body).expect(200);
const deleteTask = (id: string) =>
  request.delete(`/api/tasks/${id}`).set('Authorization', bearer(token)).expect(204);

/** `entityType action` per entry, in response order. */
const summary = (list: ListResponse<ActivityEntry>) =>
  list.data.map((entry) => `${entry.entityType} ${entry.action}`);

/** Spreads the stored timestamps one second apart in insertion order, so "newest first" is exact. */
async function spreadTimestamps() {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  for (const [index, row] of rows.entries()) {
    await prisma.auditLog.update({
      where: { id: row.id },
      data: { createdAt: new Date(Date.UTC(2026, 9, 7, 9, 0, index)) },
    });
  }
}

describe('GET /api/tasks/:id/activity', () => {
  it('T-ACT-01 create and update each add an entry with the right action', async () => {
    const created = await task({ name: 'Hero' });
    await updateTask(created.id, { status: 'IN_PROGRESS' });
    await spreadTimestamps();

    const list = await taskActivity(created.id);

    expect(summary(list)).toEqual(['TASK UPDATED', 'TASK CREATED']);
    expect(list.data.every((entry) => entry.entityId === created.id)).toBe(true);
    expect(list.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it('returns entries with exactly the ActivityEntry fields', async () => {
    const created = await task();

    const [entry] = (await taskActivity(created.id)).data;

    expect(Object.keys(entry ?? {}).sort()).toEqual(ENTRY_FIELDS);
    expect(entry).toMatchObject({
      entityType: 'TASK',
      entityId: created.id,
      action: 'CREATED',
      changes: null,
    });
    expect(new Date(entry?.createdAt ?? '').toISOString()).toBe(entry?.createdAt);
  });

  it('T-ACT-02 an update entry lists only the changed fields', async () => {
    const created = await task({ name: 'Hero', priority: 'LOW', dueDate: '2026-10-20' });
    await updateTask(created.id, {
      name: 'Hero',
      priority: 'HIGH',
      status: 'COMPLETED',
      dueDate: '2026-10-20',
    });
    // A second update that changes nothing writes no entry (D-032).
    await updateTask(created.id, { priority: 'HIGH' });

    const list = await taskActivity(created.id);

    const updates = list.data.filter((entry) => entry.action === 'UPDATED');
    expect(updates).toHaveLength(1);
    expect(updates[0]?.changes).toEqual({
      priority: { from: 'LOW', to: 'HIGH' },
      status: { from: 'PENDING', to: 'COMPLETED' },
    });
  });

  it('records descriptions truncated to 200 characters', async () => {
    const created = await task({ description: 'a'.repeat(300) });
    await updateTask(created.id, { description: 'b'.repeat(250) });

    const update = (await taskActivity(created.id)).data.find(
      (entry) => entry.action === 'UPDATED',
    );

    expect(update?.changes).toEqual({
      description: { from: 'a'.repeat(200), to: 'b'.repeat(200) },
    });
  });

  it('only includes that task’s entries', async () => {
    const first = await task({ name: 'First' });
    const second = await task({ name: 'Second' });
    await updateTask(second.id, { name: 'Second, renamed' });

    expect(summary(await taskActivity(first.id))).toEqual(['TASK CREATED']);
    expect((await taskActivity(second.id)).meta.total).toBe(2);
  });

  it('is a 404 once the task is deleted (its history stays in the project feed)', async () => {
    const created = await task();
    await deleteTask(created.id);

    const res = await fetchActivity(taskActivityUrl(created.id)).expect(404);

    expect(errorOf(res).code).toBe('NOT_FOUND');
  });
});

describe('GET /api/projects/:id/activity', () => {
  it('T-ACT-03 includes the project’s and its tasks’ entries, newest first', async () => {
    const mobile = await createProject(request, token, { name: 'Mobile', key: 'MOB' });
    const hero = await task({ name: 'Hero' });
    await task({ name: 'Elsewhere' }, mobile.id);
    await request
      .put(`/api/projects/${web.id}`)
      .set('Authorization', bearer(token))
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    await updateTask(hero.id, { priority: 'HIGH' });
    await spreadTimestamps();

    const list = await projectActivity();

    expect(summary(list)).toEqual([
      'TASK UPDATED',
      'PROJECT UPDATED',
      'TASK CREATED',
      'PROJECT CREATED',
    ]);
    expect(list.data[1]).toMatchObject({
      entityId: web.id,
      changes: { status: { from: 'NOT_STARTED', to: 'IN_PROGRESS' } },
    });
    expect(list.data.map((entry) => entry.entityId)).not.toContain(mobile.id);
    const createdAt = list.data.map((entry) => entry.createdAt);
    expect(createdAt).toEqual([...createdAt].sort().reverse());
  });

  it('T-ACT-01 / T-ACT-05 a deleted task’s CREATED, UPDATED and DELETED stay in the project feed', async () => {
    const created = await task({ name: 'Short-lived' });
    await updateTask(created.id, { name: 'Renamed' });
    await deleteTask(created.id);
    await spreadTimestamps();

    const list = await projectActivity();

    const taskEntries = list.data.filter((entry) => entry.entityId === created.id);
    expect(taskEntries.map((entry) => entry.action)).toEqual(['DELETED', 'UPDATED', 'CREATED']);
    expect(taskEntries[0]?.changes).toBeNull();
    expect(taskEntries[1]?.changes).toEqual({ name: { from: 'Short-lived', to: 'Renamed' } });
  });

  it('paginates with real meta', async () => {
    for (let index = 0; index < 4; index += 1) await task();
    await spreadTimestamps();

    const first = await projectActivity(web.id, '?limit=2');
    expect(first.meta).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
    const last = await projectActivity(web.id, '?limit=2&page=3');
    expect(summary(last)).toEqual(['PROJECT CREATED']);
    const past = await projectActivity(web.id, '?limit=2&page=4');
    expect(past.data).toEqual([]);
    expect(past.meta.total).toBe(5);
  });

  it.each([
    ['limit=0', 'limit'],
    ['limit=101', 'limit'],
    ['page=0', 'page'],
  ])('rejects an invalid query (%s) with 400', async (query, path) => {
    const res = await fetchActivity(`${projectActivityUrl(web.id)}?${query}`).expect(400);
    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    expect(errorOf(res).details?.[0]?.path).toBe(path);
  });

  it('is a 404 once the project is deleted', async () => {
    await request.delete(`/api/projects/${web.id}`).set('Authorization', bearer(token)).expect(204);

    const res = await fetchActivity(projectActivityUrl(web.id)).expect(404);

    expect(errorOf(res).code).toBe('NOT_FOUND');
  });
});

describe('cross-user access and validation', () => {
  it('T-ACT-04 another user’s project or task activity is a 404, like a missing one', async () => {
    const theirs = await createProject(request, otherToken, { name: 'Theirs', key: 'SEC' });
    const theirTask: Task = await task({ name: 'Private' }, theirs.id, otherToken);
    const auditBefore = await prisma.auditLog.count();

    for (const url of [projectActivityUrl(theirs.id), taskActivityUrl(theirTask.id)]) {
      const forbidden = await fetchActivity(url).expect(404);
      expect(errorOf(forbidden).code).toBe('NOT_FOUND');
    }
    const missingProject = await fetchActivity(projectActivityUrl(randomUUID())).expect(404);
    const forbiddenProject = await fetchActivity(projectActivityUrl(theirs.id)).expect(404);
    expect(forbiddenProject.body).toEqual(missingProject.body);

    // Nothing changed, and the owner still sees their history.
    expect(await prisma.auditLog.count()).toBe(auditBefore);
    expect((await activityOf(projectActivityUrl(theirs.id), otherToken)).meta.total).toBe(2);
    expect((await activityOf(taskActivityUrl(theirTask.id), otherToken)).meta.total).toBe(1);
  });

  it('returns 400 for a non-uuid id', async () => {
    for (const url of [projectActivityUrl('WEB'), taskActivityUrl('WEB-1')]) {
      const res = await fetchActivity(url).expect(400);
      expect(errorOf(res).code).toBe('VALIDATION_ERROR');
      expect(errorOf(res).details?.[0]?.path).toBe('id');
    }
  });

  it.each([
    projectActivityUrl(randomUUID()),
    taskActivityUrl(randomUUID()),
    `${projectActivityUrl('not-a-uuid')}?limit=0`,
    `${taskActivityUrl('not-a-uuid')}?page=0`,
  ])('GET %s without a token → 401 UNAUTHENTICATED, before validation (D-031)', async (url) => {
    const res = await request.get(url).expect(401);
    expect(errorOf(res).code).toBe('UNAUTHENTICATED');
  });
});
