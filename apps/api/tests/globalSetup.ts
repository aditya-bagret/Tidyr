import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadTestEnv } from './helpers/testEnv';

const API_ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Brings tidyr_test up to the latest migration once per run. */
export default function setup() {
  try {
    execFileSync('npx', ['--no-install', 'prisma', 'migrate', 'deploy'], {
      cwd: API_ROOT,
      env: { ...process.env, ...loadTestEnv() },
      stdio: 'pipe',
    });
  } catch (error) {
    const stderr =
      typeof error === 'object' && error !== null && 'stderr' in error ? String(error.stderr) : '';
    throw new Error(
      `prisma migrate deploy failed on the test database. Is it up (npm run db:up)?\n${stderr}`,
      { cause: error },
    );
  }
}
