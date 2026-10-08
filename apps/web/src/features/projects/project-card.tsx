import type { Project } from '@tidyr/shared';
import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ProjectDates } from './project-dates';
import { ProjectProgress } from './project-progress';

/** Key + status, name, 2-line description, date range and progress (DESIGN §3, §4.2). */
export function ProjectCard({ project, today }: { project: Project; today: string }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="flex min-w-0 flex-1 flex-col gap-3 rounded-md border border-neutral-200 bg-neutral-0 p-4 shadow-card transition-colors hover:border-brand-600/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-sm bg-neutral-100 px-1.5 py-0.5 font-mono text-xs font-medium text-neutral-600">
          {project.key}
        </span>
        <StatusBadge kind="project" status={project.status} />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="truncate text-base font-semibold text-neutral-900">{project.name}</h2>
        <p className="line-clamp-2 min-h-10 text-sm text-neutral-600">
          {project.description ?? <span className="text-neutral-400">No description</span>}
        </p>
      </div>
      <ProjectDates startDate={project.startDate} endDate={project.endDate} today={today} />
      <ProjectProgress counts={project.taskCounts} />
    </Link>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-neutral-0 p-4 shadow-card">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-10" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-1.5 w-full" />
    </div>
  );
}
