'use client';

import { todayLocal } from '@tidyr/shared';
import { ListChecksIcon, PlusIcon } from 'lucide-react';
import { useRef } from 'react';
import { EmptyState } from '@/components/empty-state';
import { RefreshButton } from '@/components/refresh-button';
import { Button } from '@/components/ui/button';
import { useShortcuts } from '@/lib/use-shortcuts';
import { PROJECT_TASKS_SORT, toTaskListParams, useTaskListState } from './list-params';
import { useTasks } from './queries';
import { PANEL, TaskCollection } from './task-collection';
import { TaskDrawer } from './task-drawer';
import { TaskFilters } from './task-filters';
import { useTaskDrawer } from './use-task-drawer';
import { ViewToggle } from './view-toggle';

/** The project page's tasks (TSK-02): List or Board, filters, "Create task" and the drawer. */
export function ProjectTasks({ projectId }: { projectId: string }) {
  const { state, update } = useTaskListState(PROJECT_TASKS_SORT);
  const today = todayLocal();
  const query = useTasks(toTaskListParams(state, { projectId, today }));
  const drawer = useTaskDrawer();
  const searchRef = useRef<HTMLInputElement>(null);

  useShortcuts({ '/': () => searchRef.current?.focus(), c: drawer.openCreate });

  return (
    <section aria-labelledby="project-tasks" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="project-tasks" className="text-base font-semibold text-neutral-900">
          Tasks
        </h2>
        <ViewToggle view={state.view} onChange={(view) => update({ view })} />
        <Button onClick={drawer.openCreate} aria-keyshortcuts="c" className="ml-auto">
          <PlusIcon aria-hidden />
          Create task
          <kbd
            aria-hidden
            className="hidden rounded-sm bg-neutral-0/20 px-1.5 font-mono text-xs sm:inline"
          >
            C
          </kbd>
        </Button>
      </div>
      <TaskFilters
        state={state}
        update={update}
        searchRef={searchRef}
        actions={
          <RefreshButton
            onRefresh={() => void query.refetch()}
            refreshing={query.isFetching && !query.isPending}
          />
        }
      />
      <TaskCollection
        query={query}
        state={state}
        update={update}
        today={today}
        onOpen={drawer.openTask}
        empty={
          <EmptyState
            icon={ListChecksIcon}
            title="No tasks yet."
            description="Break this project into tasks to track progress."
            action={
              <Button onClick={drawer.openCreate}>
                <PlusIcon aria-hidden />
                Create task
              </Button>
            }
            className={PANEL}
          />
        }
      />
      <TaskDrawer projectId={projectId} />
    </section>
  );
}
