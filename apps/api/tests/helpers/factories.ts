// Test data factories (TEST_PLAN §1). Users are inserted directly so tests don't spend the
// register limiter; logging in goes through the API like a real client.
import type { AuthResult, TokenPair } from '@tidyr/shared';
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
