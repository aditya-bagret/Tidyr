'use client';

import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
} from '@tidyr/shared';
import type { ReactNode, Ref } from 'react';
import { FilterChips } from '@/components/filter-chips';
import { SearchInput } from '@/components/search-input';
import { Button } from '@/components/ui/button';
import { hasTaskFilters, NO_TASK_FILTERS, type TaskListState } from './list-params';
import { QuickFilters } from './quick-filters';
import { TaskSortSelect } from './task-sort-select';

const STATUS_OPTIONS = TASK_STATUSES.map((value) => ({ value, label: TASK_STATUS_LABEL[value] }));
// High first, as people scan for it.
const PRIORITY_OPTIONS = [...TASK_PRIORITIES]
  .reverse()
  .map((value) => ({ value, label: TASK_PRIORITY_LABEL[value] }));

const Divider = () => <span className="hidden h-5 w-px bg-neutral-200 md:block" aria-hidden />;

interface TaskFiltersProps {
  state: TaskListState;
  update: (patch: Partial<TaskListState>, options?: { replace?: boolean }) => void;
  searchRef?: Ref<HTMLInputElement>;
  /** Buttons at the end of the search row (refresh, create). */
  actions?: ReactNode;
}

/**
 * P10.1 / APP_FLOW F8: search, Status and Priority chips, quick filters and sort, all in the URL.
 * Shared by the project page and My Tasks.
 */
export function TaskFilters({ state, update, searchRef, actions }: TaskFiltersProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          ref={searchRef}
          value={state.search}
          onChange={(search) => update({ search }, { replace: true })}
          label="Search tasks"
          placeholder="Search tasks or keys…"
          shortcutHint
          className="sm:max-w-xs"
        />
        <div className="flex items-center gap-2 sm:ml-auto">
          <TaskSortSelect
            sort={state.sort}
            order={state.order}
            onChange={(sort, order) => update({ sort, order })}
            className="min-w-0 flex-1 sm:w-52 sm:flex-none"
          />
          {actions}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FilterChips
          label="Filter by status"
          options={STATUS_OPTIONS}
          selected={state.status}
          onChange={(status) => update({ status })}
        />
        <Divider />
        <FilterChips
          label="Filter by priority"
          options={PRIORITY_OPTIONS}
          selected={state.priority}
          onChange={(priority) => update({ priority })}
        />
        <Divider />
        <QuickFilters
          due={state.due}
          priority={state.priority}
          onDueChange={(due) => update({ due })}
          onPriorityChange={(priority) => update({ priority })}
        />
        {hasTaskFilters(state) ? (
          <Button variant="link" size="sm" onClick={() => update(NO_TASK_FILTERS)}>
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
