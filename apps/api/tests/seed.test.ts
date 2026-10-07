// P5.4: `npm run db:seed` (SCHEMA §7), run as a real process against tidyr_test.
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { addDays, todayLocal, type ListResponse, type Task } from '@tidyr/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { resetDb } from './helpers/db';
import { loginAs, sessionIdOf, type TestUser } from './helpers/factories';
import { createClient } from './helpers/http';

const API_ROOT = fileURLToPath(new URL('..', import.meta.url));
const run = promisify(execFile);
const request = createClient();

const DEMO: TestUser = {
  id: '',
  fullName: 'Demo User',
  email: 'demo@tidyr.test',
  password: 'Demo@12345',
};
const OTHER: TestUser = {
  id: '',
  fullName: 'Other User',
  email: 'other@tidyr.test',
  password: 'Other@12345',
};

const seed = () =>
  run('npx', ['--no-install', 'tsx', 'prisma/seed.ts'], { cwd: API_ROOT, env: process.env });

async function tasksOf(email: string) {
  return prisma.task.findMany({
    where: { project: { owner: { email } } },
    include: { project: { select: { key: true } } },
    orderBy: [{ project: { key: 'asc' } }, { number: 'asc' }],
  });
}

describe('seed script', () => {
  let demoToken: string;

  beforeAll(async () => {
    await resetDb();
    await seed();
    demoToken = (await loginAs(request, DEMO)).accessToken;
  }, 60_000);

  it('creates the demo user’s 4 projects with ~6 sequentially numbered tasks each', async () => {
    const projects = await prisma.project.findMany({
      where: { owner: { email: DEMO.email } },
      orderBy: { key: 'asc' },
    });
    expect(projects.map((project) => [project.key, project.status])).toEqual([
      ['DOC', 'COMPLETED'],
      ['MOB', 'IN_PROGRESS'],
      ['OPS', 'NOT_STARTED'],
      ['WEB', 'IN_PROGRESS'],
    ]);

    const tasks = await tasksOf(DEMO.email);
    for (const project of projects) {
      const numbers = tasks.filter((item) => item.projectId === project.id).map((t) => t.number);
      expect(numbers).toEqual([1, 2, 3, 4, 5, 6]);
      expect(project.taskSeq).toBe(6);
    }
  });

  it('has the task mix SCHEMA §7 asks for, relative to today', async () => {
    const today = todayLocal();
    const tasks = await tasksOf(DEMO.email);
    const open = tasks.filter((item) => item.status !== 'COMPLETED');
    const due = (item: (typeof tasks)[number]) => item.dueDate?.toISOString().slice(0, 10);

    expect(open.filter((item) => (due(item) ?? '9999') < today).length).toBeGreaterThanOrEqual(2);
    expect(
      open.filter((item) => [today, addDays(today, 1)].includes(due(item) ?? '')).length,
    ).toBeGreaterThanOrEqual(2);
    expect(tasks.filter((item) => item.dueDate === null).length).toBeGreaterThanOrEqual(2);
    expect(new Set(tasks.map((item) => item.priority))).toEqual(new Set(['LOW', 'MEDIUM', 'HIGH']));

    const docs = tasks.filter((item) => item.project.key === 'DOC');
    expect(docs.every((item) => item.status === 'COMPLETED' && item.completedAt !== null)).toBe(
      true,
    );
  });

  it('serves the seed through the API: demo login, key search, filters, cross-user 404', async () => {
    const res = await request
      .get(`/api/tasks?due=overdue&today=${todayLocal()}`)
      .set('Authorization', `Bearer ${demoToken}`)
      .expect(200);
    expect((res.body as ListResponse<Task>).meta.total).toBeGreaterThanOrEqual(2);

    const otherProject = await prisma.project.findFirstOrThrow({
      where: { owner: { email: OTHER.email } },
    });
    await request
      .get(`/api/projects/${otherProject.id}`)
      .set('Authorization', `Bearer ${demoToken}`)
      .expect(404);
    await loginAs(request, OTHER);
  });

  it('is idempotent: a second run recreates the same data and keeps sessions', async () => {
    const tokens = await loginAs(request, DEMO);
    const keysBefore = (await tasksOf(DEMO.email)).map(
      (item) => `${item.project.key}-${item.number}`,
    );

    await seed();

    expect(await prisma.user.count()).toBe(2);
    expect(await prisma.project.count()).toBe(5);
    const keysAfter = (await tasksOf(DEMO.email)).map(
      (item) => `${item.project.key}-${item.number}`,
    );
    expect(keysAfter).toEqual(keysBefore);
    expect(await prisma.task.count()).toBe(26);
    // History restarts with the seed: one CREATED per project and task.
    expect(await prisma.auditLog.count()).toBe(5 + 26);
    expect(await prisma.session.findUnique({ where: { id: sessionIdOf(tokens) } })).not.toBeNull();
    await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .expect(200);
  }, 60_000);
});
