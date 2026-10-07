// The migrated schema and the harness itself: constraints the services will rely on, and resetDb().
import { beforeEach, describe, expect, it } from 'vitest';
import { fromDateOnly, toDateOnly } from '../src/lib/dates';
import { prisma } from '../src/lib/prisma';
import { resetDb } from './helpers/db';

async function createUser(email = 'owner@tidyr.test') {
  return prisma.user.create({
    data: { fullName: 'Owner', email, passwordHash: 'not-a-real-hash' },
  });
}

beforeEach(async () => {
  await resetDb();
});

describe('schema', () => {
  it('rejects a project whose end date is before its start date (CHECK constraint)', async () => {
    const user = await createUser();
    await expect(
      prisma.project.create({
        data: {
          ownerId: user.id,
          key: 'BAD',
          name: 'Backwards',
          startDate: fromDateOnly('2026-10-10'),
          endDate: fromDateOnly('2026-10-09'),
        },
      }),
    ).rejects.toThrow(/projects_dates_chk/);
  });

  it('accepts equal start and end dates, and open ranges', async () => {
    const user = await createUser();
    const same = fromDateOnly('2026-10-10');
    await prisma.project.create({
      data: { ownerId: user.id, key: 'SAME', name: 'Same day', startDate: same, endDate: same },
    });
    await prisma.project.create({
      data: { ownerId: user.id, key: 'OPEN', name: 'Open', endDate: same },
    });
    expect(await prisma.project.count()).toBe(2);
  });

  it('round-trips a DATE column without a timezone shift', async () => {
    const user = await createUser();
    const project = await prisma.project.create({
      data: { ownerId: user.id, key: 'DT', name: 'Dates', startDate: fromDateOnly('2026-12-31') },
    });
    const stored = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(stored.startDate && toDateOnly(stored.startDate)).toBe('2026-12-31');
  });

  it('enforces unique project keys per owner only', async () => {
    const a = await createUser('a@tidyr.test');
    const b = await createUser('b@tidyr.test');
    await prisma.project.create({ data: { ownerId: a.id, key: 'WEB', name: 'A' } });
    await prisma.project.create({ data: { ownerId: b.id, key: 'WEB', name: 'B' } });
    await expect(
      prisma.project.create({ data: { ownerId: a.id, key: 'WEB', name: 'A again' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('cascades a user delete to projects and tasks, and keeps audit history with project_id null', async () => {
    const user = await createUser();
    const other = await createUser('other@tidyr.test');
    const project = await prisma.project.create({
      data: { ownerId: user.id, key: 'P', name: 'P', tasks: { create: { number: 1, name: 'T' } } },
    });
    await prisma.auditLog.create({
      data: {
        userId: other.id,
        projectId: project.id,
        entityType: 'PROJECT',
        entityId: project.id,
        action: 'CREATED',
      },
    });

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.project.count()).toBe(0);
    expect(await prisma.task.count()).toBe(0);
    const audit = await prisma.auditLog.findFirstOrThrow();
    expect(audit.projectId).toBeNull();
  });
});

describe('resetDb', () => {
  it('empties every application table', async () => {
    const user = await createUser();
    await prisma.project.create({
      data: { ownerId: user.id, key: 'P', name: 'P', tasks: { create: { number: 1, name: 'T' } } },
    });
    await prisma.session.create({
      data: { userId: user.id, refreshTokenHash: 'x', expiresAt: new Date(Date.now() + 60_000) },
    });

    await resetDb();

    const counts = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.task.count(),
      prisma.session.count(),
      prisma.auditLog.count(),
    ]);
    expect(counts).toEqual([0, 0, 0, 0, 0]);
  });
});
