// Demo data (SCHEMA §7), test data only. Idempotent: the users are upserted by email, and their
// projects (with tasks) and history are deleted and recreated. Sessions are kept, so reseeding
// before a demo doesn't sign devices out. Projects and tasks go through the same services as the
// API, so keys and task numbers are generated exactly as they are for real users.
//   npm run db:seed
// Dates are relative to the machine's local date when the seed runs.
import {
  addDays,
  todayLocal,
  type CreateProjectInput,
  type ProjectStatus,
  type TaskPriority,
  type TaskStatus,
} from '@tidyr/shared';
import { logger } from '../src/config/logger';
import { hashPassword } from '../src/lib/password';
import { prisma } from '../src/lib/prisma';
import * as projectsService from '../src/modules/projects/projects.service';
import * as tasksService from '../src/modules/tasks/tasks.service';

interface SeedTask {
  name: string;
  priority: TaskPriority;
  status: TaskStatus;
  /** Days from today, or `null` for no due date. */
  due: number | null;
  description?: string;
}

interface SeedProject {
  key: string;
  name: string;
  description: string;
  status: ProjectStatus;
  /** Days from today. */
  start: number;
  end: number;
  tasks: SeedTask[];
}

interface SeedUser {
  email: string;
  fullName: string;
  password: string;
  projects: SeedProject[];
}

const USERS: SeedUser[] = [
  {
    email: 'demo@tidyr.test',
    fullName: 'Demo User',
    password: 'Demo@12345',
    projects: [
      {
        key: 'WEB',
        name: 'Website Redesign',
        description: 'Refresh the marketing site with the new brand.',
        status: 'IN_PROGRESS',
        start: -14,
        end: 30,
        tasks: [
          {
            name: 'Design hero section',
            priority: 'HIGH',
            status: 'IN_PROGRESS',
            due: 2,
            description: 'Use the new brand colours and the product screenshot.',
          },
          { name: 'Audit site accessibility', priority: 'MEDIUM', status: 'COMPLETED', due: -5 },
          { name: 'Write homepage copy', priority: 'MEDIUM', status: 'PENDING', due: -3 },
          { name: 'Set up analytics', priority: 'LOW', status: 'PENDING', due: null },
          { name: 'Build pricing page', priority: 'HIGH', status: 'PENDING', due: 0 },
          { name: 'Migrate blog posts', priority: 'LOW', status: 'PENDING', due: 12 },
        ],
      },
      {
        key: 'MOB',
        name: 'Mobile App Launch',
        description: 'Ship version 1.0 to the Play Store.',
        status: 'IN_PROGRESS',
        start: -7,
        end: 45,
        tasks: [
          { name: 'Finalize app icon', priority: 'MEDIUM', status: 'COMPLETED', due: -2 },
          {
            name: 'Fix login crash on Android 14',
            priority: 'HIGH',
            status: 'IN_PROGRESS',
            due: -1,
          },
          { name: 'Prepare store listing', priority: 'MEDIUM', status: 'PENDING', due: 1 },
          { name: 'Run beta with 20 users', priority: 'HIGH', status: 'PENDING', due: 7 },
          { name: 'Write push notification copy', priority: 'LOW', status: 'PENDING', due: null },
          { name: 'Set up crash reporting', priority: 'MEDIUM', status: 'IN_PROGRESS', due: 4 },
        ],
      },
      {
        key: 'OPS',
        name: 'Office Move',
        description: 'Move the team to the new office.',
        status: 'NOT_STARTED',
        start: 10,
        end: 40,
        tasks: [
          { name: 'Get quotes from movers', priority: 'HIGH', status: 'PENDING', due: 3 },
          {
            name: 'Set up internet at the new office',
            priority: 'HIGH',
            status: 'PENDING',
            due: 9,
          },
          { name: 'Plan seating layout', priority: 'MEDIUM', status: 'PENDING', due: 15 },
          { name: 'Order new furniture', priority: 'MEDIUM', status: 'PENDING', due: null },
          { name: 'Update address with vendors', priority: 'LOW', status: 'PENDING', due: 30 },
          {
            name: 'Farewell lunch at the old office',
            priority: 'LOW',
            status: 'PENDING',
            due: null,
          },
        ],
      },
      {
        key: 'DOC',
        name: 'Documentation Cleanup',
        description: 'Bring the internal docs up to date.',
        status: 'COMPLETED',
        start: -60,
        end: -5,
        tasks: [
          { name: 'Inventory existing docs', priority: 'MEDIUM', status: 'COMPLETED', due: -50 },
          { name: 'Remove outdated guides', priority: 'LOW', status: 'COMPLETED', due: -40 },
          { name: 'Rewrite onboarding guide', priority: 'HIGH', status: 'COMPLETED', due: -25 },
          { name: 'Add API examples', priority: 'MEDIUM', status: 'COMPLETED', due: -15 },
          { name: 'Review with the team', priority: 'MEDIUM', status: 'COMPLETED', due: -8 },
          { name: 'Publish the docs site', priority: 'HIGH', status: 'COMPLETED', due: -6 },
        ],
      },
    ],
  },
  {
    // Owns data the demo user must never see: the cross-user 404 demo.
    email: 'other@tidyr.test',
    fullName: 'Other User',
    password: 'Other@12345',
    projects: [
      {
        key: 'PRV',
        name: 'Private Research',
        description: 'Belongs to another account.',
        status: 'IN_PROGRESS',
        start: -3,
        end: 20,
        tasks: [
          { name: 'Collect interview notes', priority: 'MEDIUM', status: 'PENDING', due: 2 },
          { name: 'Summarize findings', priority: 'HIGH', status: 'PENDING', due: null },
        ],
      },
    ],
  },
];

async function upsertUser(user: SeedUser): Promise<string> {
  const passwordHash = await hashPassword(user.password);
  const { id } = await prisma.user.upsert({
    where: { email: user.email },
    create: { email: user.email, fullName: user.fullName, passwordHash },
    update: { fullName: user.fullName, passwordHash },
    select: { id: true },
  });
  return id;
}

async function seedUser(user: SeedUser, today: string): Promise<number> {
  const userId = await upsertUser(user);
  // Tasks go with their projects (cascade); history is cleared so it starts with this seed.
  await prisma.$transaction([
    prisma.project.deleteMany({ where: { ownerId: userId } }),
    prisma.auditLog.deleteMany({ where: { userId } }),
  ]);

  let taskCount = 0;
  for (const project of user.projects) {
    const input: CreateProjectInput = {
      key: project.key,
      name: project.name,
      description: project.description,
      status: project.status,
      startDate: addDays(today, project.start),
      endDate: addDays(today, project.end),
    };
    const { id: projectId } = await projectsService.create(userId, input);

    // One at a time, so numbers follow the list order (WEB-1, WEB-2, …).
    for (const task of project.tasks) {
      await tasksService.create(userId, {
        projectId,
        name: task.name,
        description: task.description ?? null,
        priority: task.priority,
        status: task.status,
        dueDate: task.due === null ? null : addDays(today, task.due),
      });
      taskCount += 1;
    }
  }
  return taskCount;
}

async function main(): Promise<void> {
  const today = todayLocal();
  for (const user of USERS) {
    const tasks = await seedUser(user, today);
    logger.info(
      { email: user.email, projects: user.projects.length, tasks, today },
      'db.seed.user',
    );
  }
}

try {
  await main();
} catch (error) {
  logger.error({ err: error }, 'db.seed.failed');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
