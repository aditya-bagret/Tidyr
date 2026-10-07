// Test data factories (TEST_PLAN §1). Users are inserted directly so tests don't spend the
// register limiter; logging in goes through the API like a real client.
import type {
  AuthResult,
  CreateProjectInput,
  CreateTaskInput,
  Project,
  Task,
  TaskStatus,
  TokenPair,
} from '@tidyr/shared';
import { hashPassword } from '../../src/lib/password';
import { prisma } from '../../src/lib/prisma';
import { dataOf, type TestClient } from './http';

export const TEST_PASSWORD = 'Passw0rd!';

export interface TestUser {
  id: string;
  fullName: string;
  email: string;
  password: string;
}

let sequence = 0;

export async function createUser(overrides: Partial<Omit<TestUser, 'id'>> = {}): Promise<TestUser> {
  sequence += 1;
  const fields = {
    fullName: 'Test User',
    email: `user${sequence}@tidyr.test`,
    password: TEST_PASSWORD,
    ...overrides,
  };
  const { id } = await prisma.user.create({
    data: {
      fullName: fields.fullName,
      email: fields.email,
      passwordHash: await hashPassword(fields.password),
    },
    select: { id: true },
  });
  return { id, ...fields };
}

export async function loginAs(request: TestClient, user: TestUser): Promise<TokenPair> {
  const res = await request
    .post('/api/auth/login')
    .send({ email: user.email, password: user.password })
    .expect(200);
  const { accessToken, refreshToken } = dataOf<AuthResult>(res);
  return { accessToken, refreshToken };
}

/** The session id is the refresh token's prefix (and the access token's `sid`). */
export const sessionIdOf = (tokens: TokenPair) => tokens.refreshToken.split('.')[0] ?? '';

export async function createProject(
  request: TestClient,
  accessToken: string,
  overrides: Partial<CreateProjectInput> = {},
): Promise<Project> {
  const res = await request
    .post('/api/projects')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name: 'Website Redesign', ...overrides })
    .expect(201);
  return dataOf<Project>(res);
}

export async function createTask(
  request: TestClient,
  accessToken: string,
  projectId: string,
  overrides: Partial<Omit<CreateTaskInput, 'projectId'>> = {},
): Promise<Task> {
  const res = await request
    .post('/api/tasks')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ projectId, name: 'Design hero section', ...overrides })
    .expect(201);
  return dataOf<Task>(res);
}

/**
 * Inserts a task row directly, numbering it like the tasks service does (SCHEMA §5). For bulk
 * setup that doesn't need to go through the API.
 */
export async function insertTask(projectId: string, status: TaskStatus = 'PENDING') {
  return prisma.$transaction(async (tx) => {
    const { taskSeq } = await tx.project.update({
      where: { id: projectId },
      data: { taskSeq: { increment: 1 } },
      select: { taskSeq: true },
    });
    return tx.task.create({
      data: {
        projectId,
        number: taskSeq,
        name: `Task ${taskSeq}`,
        status,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
      select: { id: true },
    });
  });
}
