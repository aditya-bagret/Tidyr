'use client';

import { todayLocal } from '@tidyr/shared';
import { ListChecksIcon, PlusIcon } from 'lucide-react';
import { useRef } from 'react';
import { EmptyState } from '@/components/empty-state';
import { RefreshButton } from '@/components/refresh-button';
import { Button } from '@/components/ui/button';
import { useShortcuts } from '@/lib/use-shortcuts';
import { MY_TASKS_SORT, toTaskListParams, useTaskListState } from './list-params';
import { useTasks } from './queries';
import { PANEL, TaskCollection } from './task-collection';
import { TaskDrawer } from './task-drawer';
import { TaskFilters } from './task-filters';
import { useTaskDrawer } from './use-task-drawer';

/**
 * `/tasks` (TSK-11): every task across the caller's projects, with the project page's search and
 * filters, overdue first by default (`sort=urgency`, D-038). The dashboard deep-links here.
 */
export function MyTasksPage() {
  const { state, update } = useTaskListState(MY_TASKS_SORT);
  const today = todayLocal();
  // My Tasks is a list; a stray `?view=board` is ignored.
  const listState = state.view === 'list' ? state : { ...state, view: 'list' as const };
  const query = useTasks(toTaskListParams(listState, { today }));
  const drawer = useTaskDrawer();
  const searchRef = useRef<HTMLInputElement>(null);

  useShortcuts({ '/': () => searchRef.current?.focus(), c: drawer.openCreate });

  return (
    <div className="flex flex-col gap-4">
      <TaskFilters
        state={listState}
        update={update}
        searchRef={searchRef}
        actions={
          <>
            <RefreshButton
              onRefresh={() => void query.refetch()}
              refreshing={query.isFetching && !query.isPending}
            />
            <Button onClick={drawer.openCreate} aria-keyshortcuts="c">
              <PlusIcon aria-hidden />
              {/* The name always contains the visible words (WCAG 2.5.3), for voice control. */}
              <span className="sm:hidden">
                New<span className="sr-only"> task</span>
              </span>
              <span className="hidden sm:inline">Create task</span>
            </Button>
          </>
        }
      />
      <TaskCollection
        query={query}
        state={listState}
        update={update}
        today={today}
        onOpen={drawer.openTask}
        showProject
        empty={
          <EmptyState
            icon={ListChecksIcon}
            title="No tasks yet."
            description="Tasks from all your projects show up here."
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
      <TaskDrawer />
    </div>
  );
}
