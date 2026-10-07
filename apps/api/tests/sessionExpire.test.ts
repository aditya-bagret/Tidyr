// P3.7: `npm run session:expire -w @tidyr/api -- <email>`, run as a real process against tidyr_test.
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { resetDb } from './helpers/db';
import { createUser, loginAs, sessionIdOf } from './helpers/factories';
import { createClient, errorOf } from './helpers/http';

const API_ROOT = fileURLToPath(new URL('..', import.meta.url));
const run = promisify(execFile);
const request = createClient();

// Only DATABASE_URL is passed on, to prove the script needs nothing else (e.g. against production).
function sessionExpire(...args: string[]) {
  return run('npx', ['--no-install', 'tsx', 'scripts/session-expire.ts', ...args], {
    cwd: API_ROOT,
    env: { PATH: process.env.PATH, DATABASE_URL: process.env.DATABASE_URL },
  });
}

beforeEach(async () => {
  await resetDb();
});

describe('session:expire script', () => {
  it("expires every live session of that user only, so their next request is 'session expired'", async () => {
    const demo = await createUser({ email: 'demo@tidyr.test' });
    const other = await createUser();
    const phone = await loginAs(request, demo);
    const web = await loginAs(request, demo);
    const otherTokens = await loginAs(request, other);

    const { stdout } = await sessionExpire('  DEMO@tidyr.test ');
    expect(stdout).toBe('Expired 2 session(s) for demo@tidyr.test.\n');

    for (const tokens of [phone, web]) {
      const me = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(401);
      expect(errorOf(me).code).toBe('SESSION_REVOKED');
      const refreshed = await request
        .post('/api/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
      expect(errorOf(refreshed).code).toBe('INVALID_REFRESH_TOKEN');
    }

    await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${otherTokens.accessToken}`)
      .expect(200);
    const untouched = await prisma.session.findUniqueOrThrow({
      where: { id: sessionIdOf(otherTokens) },
    });
    expect(untouched.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('exits 1 for an unknown email or a missing argument', async () => {
    await expect(sessionExpire('nobody@tidyr.test')).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('No user with email nobody@tidyr.test') as string,
    });
    await expect(sessionExpire()).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('Usage:') as string,
    });
  });
});
