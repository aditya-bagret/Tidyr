'use client';

import { todayLocal, type Dashboard as DashboardData } from '@tidyr/shared';
import { useQuery } from '@tanstack/react-query';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  FolderClockIcon,
  FolderKanbanIcon,
  ListChecksIcon,
  PlusIcon,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Banner } from '@/components/banner';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { RefreshButton } from '@/components/refresh-button';
import { StatCard, StatCardSkeleton } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/features/auth/auth-provider';
import { ProjectFormDialog } from '@/features/projects/project-form-dialog';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { firstName } from '@/lib/names';
import { queryKeys } from '@/lib/queryKeys';
import { PriorityBreakdown } from './priority-breakdown';
import { TaskListCard, TaskListCardSkeleton } from './task-list-card';

interface Stat {
  label: string;
  icon: LucideIcon;
  value: (data: DashboardData) => number;
  href: string;
  danger?: boolean;
}

// DSH-01 (the brief's five, in its wording) then DSH-03's extras; each deep-links (APP_FLOW F9).
const STATS: readonly Stat[] = [
  {
    label: 'Total Projects',
    icon: FolderKanbanIcon,
    value: (d) => d.totalProjects,
    href: '/projects',
  },
  {
    label: 'Projects In Progress',
    icon: FolderClockIcon,
    value: (d) => d.projectsInProgress,
    href: '/projects?status=IN_PROGRESS',
  },
  { label: 'Total Tasks', icon: ListChecksIcon, value: (d) => d.totalTasks, href: '/tasks' },
  {
    label: 'Completed Tasks',
    icon: CircleCheckIcon,
    value: (d) => d.completedTasks,
    href: '/tasks?status=COMPLETED',
  },
  {
    label: 'Pending Tasks',
    icon: CircleDashedIcon,
    value: (d) => d.pendingTasks,
    href: '/tasks?status=PENDING',
  },
  {
    label: 'Tasks In Progress',
    icon: CircleDotIcon,
    value: (d) => d.inProgressTasks,
    href: '/tasks?status=IN_PROGRESS',
  },
  {
    label: 'Overdue Tasks',
    icon: CircleAlertIcon,
    value: (d) => d.overdueTasks,
    href: '/tasks?due=overdue',
    danger: true,
  },
];

const STAT_GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7';
const CARD = 'rounded-md border border-neutral-200 bg-neutral-0 shadow-card';

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** DESIGN §4.1 / APP_FLOW F9. `today` is the device's date so "overdue" matches the user's day (D-009). */
export function Dashboard() {
  const user = useCurrentUser();
  const today = todayLocal();
  const query = useQuery({
    queryKey: queryKeys.dashboard.byDay(today),
    queryFn: () => api.dashboard.get({ today }),
  });
  const [creating, setCreating] = useState(false);
  const { data } = query;

  let content;
  if (query.isPending) {
    content = (
      <>
        <div className={STAT_GRID} aria-busy>
          <span className="sr-only">Loading dashboard…</span>
          {STATS.map((stat) => (
            <StatCardSkeleton key={stat.label} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TaskListCardSkeleton />
          <TaskListCardSkeleton />
        </div>
      </>
    );
  } else if (query.isError && !data) {
    content = (
      <ErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        className={CARD}
      />
    );
  } else if (data) {
    content = (
      <>
        {query.isRefetchError ? (
          <Banner tone="warning">
            Couldn&apos;t refresh the dashboard. {errorMessage(query.error)}
          </Banner>
        ) : null}
        <div className={STAT_GRID}>
          {STATS.map((stat) => {
            const value = stat.value(data);
            return (
              <StatCard
                key={stat.label}
                icon={stat.icon}
                label={stat.label}
                value={value}
                href={stat.href}
                tone={stat.danger && value > 0 ? 'danger' : 'default'}
              />
            );
          })}
        </div>
        {data.totalProjects === 0 ? (
          <EmptyState
            icon={FolderKanbanIcon}
            title="No projects yet."
            description="Create your first project to start organizing tasks."
            action={
              <Button onClick={() => setCreating(true)}>
                <PlusIcon aria-hidden />
                Create your first project
              </Button>
            }
            className={CARD}
          />
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <TaskListCard
                id="dashboard-overdue"
                title="Overdue"
                count={data.overdueTasks}
                tasks={data.overdue}
                today={today}
                emptyText="Nothing overdue. Nice work."
                action={
                  data.overdueTasks > 0 ? (
                    <Link
                      href="/tasks?due=overdue"
                      className="text-sm font-medium text-brand-600 hover:underline"
                    >
                      View all
                    </Link>
                  ) : null
                }
              />
              <TaskListCard
                id="dashboard-upcoming"
                title="Upcoming"
                tasks={data.upcoming}
                today={today}
                emptyText="No upcoming due dates."
              />
            </div>
            <PriorityBreakdown counts={data.tasksByPriority} total={data.totalTasks} />
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-semibold text-neutral-900">
          {greeting(new Date().getHours())}, {firstName(user.fullName)} <span aria-hidden>👋</span>
        </h2>
        <RefreshButton
          onRefresh={() => void query.refetch()}
          refreshing={query.isFetching && !query.isPending}
          className="ml-auto"
        />
      </div>
      {content}
      <ProjectFormDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
