'use client';

import type { ListResponse, Task, UpdateTaskInput } from '@tidyr/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { cn } from 'cn';
import { SearchXIcon } from 'lucide-react';
import { useCallback, useEffect, type ReactNode } from 'react';
import { Banner } from '@/components/banner';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Pagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/errors';
import { hasTaskFilters, NO_TASK_FILTERS, type TaskListState } from './list-params';
import { isChange, useUpdateTask } from './queries';
import { TaskBoard } from './task-board';
import { TaskRow, TaskRowSkeleton } from './task-row';

export const PANEL = 'rounded-md border border-neutral-200 bg-neutral-0 shadow-card';

interface TaskCollectionProps {
  query: UseQueryResult<ListResponse<Task>>;
  state: TaskListState;
  update: (patch: Partial<TaskListState>, options?: { replace?: boolean }) => void;
  today: string;
  onOpen: (id: string) => void;
  /** Shown when there are no tasks at all (not just none matching the filters). */
  empty: ReactNode;
  showProject?: boolean;
}

/** The list or board with every APP_FLOW §5 state: skeletons, error + Retry, empty, no results. */
export function TaskCollection({
  query,
  state,
  update,
  today,
  onOpen,
  empty,
  showProject = false,
}: TaskCollectionProps) {
  const { mutate: updateTask } = useUpdateTask();
  const { data, isPlaceholderData } = query;
  const board = state.view === 'board';

  const onUpdate = useCallback(
    (task: Task, patch: UpdateTaskInput) => {
      if (isChange(task, patch)) updateTask({ task, patch });
    },
    [updateTask],
  );

  // A page past the end (after deleting the last task on it, or a stale link) steps back.
  const lastPage = data?.meta.totalPages ?? 0;
  const pastTheEnd =
    !board && data !== undefined && !isPlaceholderData && state.page > Math.max(lastPage, 1);
  useEffect(() => {
    if (pastTheEnd) update({ page: Math.max(lastPage, 1) }, { replace: true });
  }, [pastTheEnd, lastPage, update]);

  if (query.isPending) return board ? <BoardSkeleton /> : <ListSkeleton />;
  if (query.isError && !data) {
    return (
      <ErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        className={PANEL}
      />
    );
  }
  if (!data || pastTheEnd) return null;

  const refetchError =
    query.isRefetchError && data ? (
      <Banner tone="warning">Couldn&apos;t refresh the tasks. {errorMessage(query.error)}</Banner>
    ) : null;

  if (data.data.length === 0) {
    return (
      <>
        {refetchError}
        {hasTaskFilters(state) ? (
          <EmptyState
            icon={SearchXIcon}
            title="No tasks match your filters."
            action={
              <Button variant="secondary" onClick={() => update(NO_TASK_FILTERS)}>
                Clear filters
              </Button>
            }
            className={PANEL}
          />
        ) : (
          empty
        )}
      </>
    );
  }

  if (board) {
    return (
      <>
        {refetchError}
        {data.meta.total > data.data.length ? (
          <Banner tone="info">
            Showing the first {data.data.length} of {data.meta.total} tasks. Filter the board or use
            the list view to see the rest.
          </Banner>
        ) : null}
        <TaskBoard tasks={data.data} today={today} onOpen={onOpen} onUpdate={onUpdate} />
      </>
    );
  }

  return (
    <>
      {refetchError}
      <ul className={cn(PANEL, 'divide-y divide-neutral-200')} aria-label="Tasks">
        {data.data.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            today={today}
            onOpen={onOpen}
            onUpdate={onUpdate}
            showProject={showProject}
          />
        ))}
      </ul>
      <Pagination meta={data.meta} noun="task" onPageChange={(page) => update({ page })} />
    </>
  );
}

function ListSkeleton() {
  return (
    <ul className={cn(PANEL, 'divide-y divide-neutral-200')} aria-busy>
      {Array.from({ length: 6 }, (_, index) => (
        <TaskRowSkeleton key={index} />
      ))}
      <li className="sr-only">Loading tasks…</li>
    </ul>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-3" aria-busy>
      <span className="sr-only">Loading tasks…</span>
      {Array.from({ length: 3 }, (_, column) => (
        <div key={column} className="flex flex-col gap-2 rounded-md bg-neutral-100 p-2">
          <Skeleton className="m-1 h-4 w-24" />
          {Array.from({ length: 3 - column }, (_, card) => (
            <Skeleton key={card} className="h-20 w-full bg-neutral-0" />
          ))}
        </div>
      ))}
    </div>
  );
}
