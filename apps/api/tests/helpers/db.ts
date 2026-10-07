import { prisma } from '../../src/lib/prisma';

/** Empties every application table. Call it in `beforeEach` of each integration test file. */
export async function resetDb(): Promise<void> {
  await prisma.$executeRaw`TRUNCATE TABLE "audit_logs", "tasks", "projects", "sessions", "users" CASCADE`;
}
