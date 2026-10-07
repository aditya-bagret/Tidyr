import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env itself. Variables already set in the environment win, so the test
// harness and the hosting dashboards can point the CLI at another database.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // Read directly rather than through `env()`, which throws when the variable is missing:
  // `prisma generate` (postinstall, CI) has no database and doesn't need one.
  datasource: { url: process.env.DATABASE_URL },
});
