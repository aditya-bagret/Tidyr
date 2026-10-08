'use client';

import { formatDate, isApiError, todayLocal, uuid, type Project } from '@tidyr/shared';
import { ArrowLeftIcon, EllipsisIcon, FolderXIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Banner } from '@/components/banner';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { RefreshButton } from '@/components/refresh-button';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/errors';
import { ProjectTasks } from '@/features/tasks/project-tasks';
import { ProjectDates } from './project-dates';
import { ProjectDeleteDialog } from './project-delete-dialog';
import { ProjectFormDialog } from './project-form-dialog';
import { ProjectProgress } from './project-progress';
import { useProject } from './queries';

const CARD = 'rounded-md border border-neutral-200 bg-neutral-0 shadow-card';

/** `/projects/[id]`: the header (P9.5) and the project's tasks (Phase 10). */
export function ProjectDetail({ id }: { id: string }) {
  // A malformed id can't exist; the API would answer 400, so skip the request (APP_FLOW §5).
  const validId = uuid.safeParse(id).success;
  const query = useProject(id, validId);

  if (!validId || (isApiError(query.error) && query.error.status === 404)) {
    return <ProjectNotFound />;
  }
  if (query.isPending) return <ProjectHeaderSkeleton />;
  // A failed background refetch (e.g. after a task change while offline) keeps the page.
  if (query.isError && !query.data) {
    return (
      <ErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        className={CARD}
      />
    );
  }

  const project = query.data;
  return (
    <div className="flex flex-col gap-6">
      <ProjectHeader
        project={project}
        onRefresh={() => void query.refetch()}
        refreshing={query.isFetching}
      />
      {query.isRefetchError ? (
        <Banner tone="warning">
          Couldn&apos;t refresh the project. {errorMessage(query.error)}
        </Banner>
      ) : null}
      <ProjectTasks projectId={project.id} />
    </div>
  );
}

interface ProjectHeaderProps {
  project: Project;
  onRefresh: () => void;
  refreshing: boolean;
}

function ProjectHeader({ project, onRefresh, refreshing }: ProjectHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const actionsRef = useRef<HTMLButtonElement>(null);
  const today = todayLocal();
  const created = formatDate(todayLocal(new Date(project.createdAt)), today);
  const { pending, inProgress, completed } = project.taskCounts;

  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <nav aria-label="Breadcrumb" className="min-w-0 text-sm text-neutral-600">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/projects" className="hover:text-brand-700 hover:underline">
                Projects
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="font-mono text-xs font-medium">
              {project.key}
            </li>
          </ol>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <RefreshButton onRefresh={onRefresh} refreshing={refreshing} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button ref={actionsRef} variant="ghost" size="icon" aria-label="Project actions">
                <EllipsisIcon aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <PencilIcon aria-hidden />
                Edit project
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                <Trash2Icon aria-hidden />
                Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="min-w-0 text-2xl font-semibold break-words text-neutral-900">
          {project.name}
        </h2>
        <StatusBadge kind="project" status={project.status} />
      </div>

      {project.description ? (
        <p className="max-w-3xl text-sm whitespace-pre-line text-neutral-600">
          {project.description}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
        <ProjectDates startDate={project.startDate} endDate={project.endDate} today={today} />
        <ProjectProgress counts={project.taskCounts} className="md:w-64" />
      </div>

      <p className="text-xs text-neutral-600">
        {pending} pending · {inProgress} in progress · {completed} completed · Created{' '}
        <time dateTime={project.createdAt}>{created}</time>
      </p>

      <ProjectFormDialog
        open={editing}
        onOpenChange={setEditing}
        project={project}
        returnFocusRef={actionsRef}
      />
      <ProjectDeleteDialog
        project={project}
        open={deleting}
        onOpenChange={setDeleting}
        returnFocusRef={actionsRef}
      />
    </header>
  );
}

function ProjectHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      <span className="sr-only">Loading project…</span>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-72 max-w-full" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="h-4 w-64 max-w-full" />
      <Skeleton className="mt-3 h-48 w-full" />
    </div>
  );
}

function ProjectNotFound() {
  return (
    <EmptyState
      icon={FolderXIcon}
      title="This project doesn't exist or you don't have access to it."
      action={
        <Button variant="secondary" asChild>
          <Link href="/projects">
            <ArrowLeftIcon aria-hidden />
            Back to projects
          </Link>
        </Button>
      }
      className={CARD}
    />
  );
}
