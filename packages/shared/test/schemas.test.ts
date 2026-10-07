import { describe, expect, it } from 'vitest';
import {
  createProjectSchema,
  createTaskSchema,
  dateOnly,
  idParamSchema,
  listProjectsQuerySchema,
  listTasksQuerySchema,
  loginSchema,
  nullableDescription,
  projectKeySchema,
  registerFormSchema,
  registerSchema,
  updateProjectSchema,
  updateTaskSchema,
} from '../src';

const PROJECT_ID = '6b1f3c2e-8a4d-4f1b-9c3e-2d5a7b8c9e0f';

function issuePaths(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((issue) => issue.path.join('.')) ?? [];
}

describe('dateOnly (T-SH-01)', () => {
  it.each(['2026-02-28', '2028-02-29', '2026-12-31'])('accepts %s', (value) => {
    expect(dateOnly.safeParse(value).success).toBe(true);
  });

  it.each(['2026-02-30', '2026-13-01', '26-1-1', '', '2026-02-28T00:00', '2027-02-29'])(
    'rejects %j',
    (value) => {
      expect(dateOnly.safeParse(value).success).toBe(false);
    },
  );
});

describe('registerSchema (T-SH-02)', () => {
  const valid = { fullName: 'Demo User', email: 'demo@tidyr.test', password: 'Passw0rd!' };

  it('trims and lowercases the email and trims the name', () => {
    const result = registerSchema.parse({
      ...valid,
      fullName: '  Demo User ',
      email: '  Demo@Tidyr.TEST ',
    });
    expect(result).toEqual({ ...valid, fullName: 'Demo User', email: 'demo@tidyr.test' });
  });

  it.each([
    ['a bad email', { email: 'not-an-email' }, 'email'],
    ['a password without a digit', { password: 'Password!' }, 'password'],
    ['a password without a letter', { password: '12345678' }, 'password'],
    ['a 7-character password', { password: 'Passw0r' }, 'password'],
    ['a whitespace-only name', { fullName: '    ' }, 'fullName'],
    ['a 1-character name', { fullName: 'A' }, 'fullName'],
  ])('rejects %s', (_label, override, path) => {
    const result = registerSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain(path);
  });

  it('accepts exactly 72 bytes and rejects 73', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'a1' + 'x'.repeat(70) }).success).toBe(
      true,
    );
    expect(registerSchema.safeParse({ ...valid, password: 'a1' + 'x'.repeat(71) }).success).toBe(
      false,
    );
  });

  it('counts UTF-8 bytes, not characters (30 × "é€" = 150 bytes in 60 characters)', () => {
    const password = 'a1' + 'é€'.repeat(30);
    expect(password.length).toBe(62);
    const result = registerSchema.safeParse({ ...valid, password });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/too long/i);
  });

  it('does not trim the password', () => {
    expect(registerSchema.parse({ ...valid, password: ' Passw0rd ' }).password).toBe(' Passw0rd ');
  });

  it('registerFormSchema reports a confirmPassword mismatch on that field', () => {
    const result = registerFormSchema.safeParse({ ...valid, confirmPassword: 'Different1' });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual(['confirmPassword']);
  });

  it('loginSchema only requires a non-empty password', () => {
    expect(loginSchema.safeParse({ email: 'demo@tidyr.test', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'demo@tidyr.test', password: '' }).success).toBe(false);
  });
});

describe('createProjectSchema (T-SH-03)', () => {
  it('rejects endDate before startDate on the endDate field', () => {
    const result = createProjectSchema.safeParse({
      name: 'Web',
      startDate: '2026-10-10',
      endDate: '2026-10-09',
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual(['endDate']);
  });

  it('accepts equal dates and a single date', () => {
    expect(
      createProjectSchema.safeParse({ name: 'Web', startDate: '2026-10-10', endDate: '2026-10-10' })
        .success,
    ).toBe(true);
    expect(createProjectSchema.safeParse({ name: 'Web', endDate: '2026-10-10' }).success).toBe(
      true,
    );
  });

  it('strips unknown fields such as ownerId and id', () => {
    const result = createProjectSchema.parse({ name: 'Web', ownerId: PROJECT_ID, id: PROJECT_ID });
    expect(result).toEqual({ name: 'Web' });
  });

  it('normalizes key and description', () => {
    const result = createProjectSchema.parse({ name: ' Web ', key: ' web2 ', description: '  ' });
    expect(result).toEqual({ name: 'Web', key: 'WEB2', description: null });
  });

  it.each(['W', '1AB', 'TOOLONGKEY1', 'WE-B'])('rejects key %j', (key) => {
    expect(projectKeySchema.safeParse(key).success).toBe(false);
  });

  it('caps description at 5000 characters', () => {
    expect(nullableDescription.safeParse('x'.repeat(5000)).success).toBe(true);
    expect(nullableDescription.safeParse('x'.repeat(5001)).success).toBe(false);
  });
});

describe('update schemas (T-SH-04)', () => {
  it('reject an empty body', () => {
    expect(updateProjectSchema.safeParse({}).success).toBe(false);
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
  });

  it('reject a body that only has stripped fields', () => {
    expect(updateProjectSchema.safeParse({ ownerId: PROJECT_ID }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ projectId: PROJECT_ID }).success).toBe(false);
  });

  it('updateTaskSchema strips projectId (D-008)', () => {
    expect(updateTaskSchema.parse({ projectId: PROJECT_ID, status: 'COMPLETED' })).toEqual({
      status: 'COMPLETED',
    });
  });

  it('updateProjectSchema accepts a partial body and checks the range when both dates are sent', () => {
    expect(updateProjectSchema.parse({ status: 'IN_PROGRESS' })).toEqual({ status: 'IN_PROGRESS' });
    expect(updateProjectSchema.safeParse({ endDate: null }).success).toBe(true);
    expect(
      updateProjectSchema.safeParse({ startDate: '2026-10-10', endDate: '2026-10-01' }).success,
    ).toBe(false);
  });
});

describe('enum fields (T-SH-05)', () => {
  const base = { projectId: PROJECT_ID, name: 'Task' };

  it.each([
    ['status', 'done'],
    ['status', 'pending'],
    ['status', ''],
    ['priority', 'high'],
    ['priority', ''],
  ])('reject %s = %j', (field, value) => {
    expect(createTaskSchema.safeParse({ ...base, [field]: value }).success).toBe(false);
  });

  it('rejects a lowercase project status', () => {
    expect(createProjectSchema.safeParse({ name: 'P', status: 'completed' }).success).toBe(false);
  });

  it('accepts exact values', () => {
    expect(createTaskSchema.parse({ ...base, status: 'IN_PROGRESS', priority: 'HIGH' })).toEqual({
      ...base,
      status: 'IN_PROGRESS',
      priority: 'HIGH',
    });
  });
});

describe('csvEnum query lists (T-SH-06)', () => {
  it('parses and de-duplicates a comma list', () => {
    const result = listTasksQuerySchema.parse({ status: 'PENDING,IN_PROGRESS,PENDING' });
    expect(result.status).toEqual(['PENDING', 'IN_PROGRESS']);
  });

  it('rejects a list containing an unknown value', () => {
    const result = listTasksQuerySchema.safeParse({ status: 'PENDING,FOO' });
    expect(result.success).toBe(false);
    expect(issuePaths(result)[0]).toMatch(/^status/);
  });

  it('ignores an empty value', () => {
    expect(listTasksQuerySchema.parse({ priority: '' }).priority).toBeUndefined();
  });
});

describe('list query schemas (T-SH-07)', () => {
  it('listTasksQuerySchema applies defaults', () => {
    const result = listTasksQuerySchema.parse({});
    expect(result).toMatchObject({ page: 1, limit: 20, sort: 'createdAt', order: 'desc' });
    expect(dateOnly.safeParse(result.today).success).toBe(true);
  });

  it('coerces numeric strings from the query string', () => {
    expect(listTasksQuerySchema.parse({ page: '3', limit: '50' })).toMatchObject({
      page: 3,
      limit: 50,
    });
  });

  it.each(['0', '101', '2.5', 'abc'])('rejects limit=%s', (limit) => {
    expect(listTasksQuerySchema.safeParse({ limit }).success).toBe(false);
  });

  it('rejects page=0, an unknown sort, a bad due filter and a bad projectId', () => {
    expect(listTasksQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(listTasksQuerySchema.safeParse({ sort: 'ownerId' }).success).toBe(false);
    expect(listTasksQuerySchema.safeParse({ due: 'tomorrow' }).success).toBe(false);
    expect(listTasksQuerySchema.safeParse({ projectId: 'abc' }).success).toBe(false);
  });

  it('ignores an empty search and trims a non-empty one', () => {
    expect(listProjectsQuerySchema.parse({ search: '   ' }).search).toBeUndefined();
    expect(listProjectsQuerySchema.parse({ search: ' web ' }).search).toBe('web');
  });

  it('listProjectsQuerySchema applies defaults', () => {
    expect(listProjectsQuerySchema.parse({})).toEqual({
      sort: 'createdAt',
      order: 'desc',
      page: 1,
      limit: 20,
    });
  });

  it('idParamSchema rejects a non-uuid id', () => {
    expect(idParamSchema.safeParse({ id: '123' }).success).toBe(false);
    expect(idParamSchema.safeParse({ id: PROJECT_ID }).success).toBe(true);
  });
});
