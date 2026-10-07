// Dev/demo tool (IMPLEMENTATION_PLAN P3.7): expires every live session of one user, so their next
// request on any device ends in the "session expired" flow (TEST_PLAN §4, §6).
//   npm run session:expire -w @tidyr/api -- demo@tidyr.test
// It needs only DATABASE_URL, so it also works against production:
//   DATABASE_URL='<neon url>' npm run session:expire -w @tidyr/api -- demo@tidyr.test
import { PrismaPg } from '@prisma/adapter-pg';
import { emailSchema } from '@tidyr/shared';
import { PrismaClient } from '../src/generated/prisma/client';

const USAGE = 'Usage: npm run session:expire -w @tidyr/api -- <email>';

async function main(): Promise<number> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set.');
    return 1;
  }
  const email = emailSchema.safeParse(process.argv[2] ?? '');
  if (!email.success) {
    console.error(USAGE);
    return 1;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.data },
      select: { id: true },
    });
    if (!user) {
      console.error(`No user with email ${email.data}.`);
      return 1;
    }

    const now = new Date();
    // Only live sessions: moving an already-expired one to "now" would push back its housekeeping.
    const { count } = await prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: now } },
      data: { expiresAt: now },
    });
    process.stdout.write(`Expired ${count} session(s) for ${email.data}.\n`);
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

process.exitCode = await main();
