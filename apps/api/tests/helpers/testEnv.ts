import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const ENV_FILE = fileURLToPath(new URL('../../.env.test', import.meta.url));

/**
 * Reads apps/api/.env.test (copy it from .env.example; see that file). Refuses any database whose
 * name doesn't end in `_test`, because every test file truncates all tables.
 */
export function loadTestEnv(): Record<string, string> {
  let contents: string;
  try {
    contents = readFileSync(ENV_FILE, 'utf8');
  } catch {
    throw new Error(`Missing ${ENV_FILE}. Create it from apps/api/.env.example (see CLAUDE.md).`);
  }

  const vars = Object.fromEntries(
    Object.entries(parseEnv(contents)).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  const dbName = new URL(vars.DATABASE_URL ?? 'postgresql://invalid/').pathname.slice(1);
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to run tests against "${dbName}": DATABASE_URL must end in _test.`);
  }
  return vars;
}
