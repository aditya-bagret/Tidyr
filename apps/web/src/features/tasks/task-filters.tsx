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

// Only the 640–767 px wrapped layout drops it; the phone row scrolls, so the groups stay apart.
const Divider = () => (
  <span className="h-5 w-px shrink-0 bg-neutral-200 sm:max-md:hidden" aria-hidden />
);

// Below 640 px the chips are one sideways-scrolling row (like mobile) instead of four wrapped rows.
// The vertical padding keeps the chips' enlarged hit areas and focus rings inside the scroller.
const CHIP_ROW =
  '-mx-4 flex items-center gap-x-3 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:gap-y-2 sm:overflow-visible sm:p-0';
const CHIP_GROUP = 'max-sm:flex-nowrap';

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
      <div className={CHIP_ROW}>
        <FilterChips
          label="Filter by status"
          options={STATUS_OPTIONS}
          selected={state.status}
          onChange={(status) => update({ status })}
          className={CHIP_GROUP}
        />
        <Divider />
        <FilterChips
          label="Filter by priority"
          options={PRIORITY_OPTIONS}
          selected={state.priority}
          onChange={(priority) => update({ priority })}
          className={CHIP_GROUP}
        />
        <Divider />
        <QuickFilters
          due={state.due}
          priority={state.priority}
          onDueChange={(due) => update({ due })}
          onPriorityChange={(priority) => update({ priority })}
          className={CHIP_GROUP}
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
