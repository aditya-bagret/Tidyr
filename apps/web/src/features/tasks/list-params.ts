'use client';

import {
  listTasksQuerySchema,
  type ListTasksParams,
  type SortOrder,
  type TaskDueFilter,
  type TaskPriority,
  type TaskSortField,
  type TaskStatus,
} from '@tidyr/shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export const TASKS_PAGE_SIZE = 20;
/** The board loads one page of up to the API's maximum and groups it into columns. */
export const BOARD_LIMIT = 100;

export const TASK_VIEWS = ['list', 'board'] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

export interface TaskListState {
  search: string;
  status: TaskStatus[];
  priority: TaskPriority[];
  due: TaskDueFilter | undefined;
  sort: TaskSortField;
  order: SortOrder;
  page: number;
  view: TaskView;
}

export interface TaskSortDefault {
  sort: TaskSortField;
  order: SortOrder;
}

/** The project page lists newest first; My Tasks puts overdue first (TSK-11, D-038). */
export const PROJECT_TASKS_SORT: TaskSortDefault = { sort: 'createdAt', order: 'desc' };
export const MY_TASKS_SORT: TaskSortDefault = { sort: 'urgency', order: 'asc' };

/** Drawer params ride along with the list state; filter changes keep them. */
const DRAWER_PARAMS = ['task', 'newTask'] as const;

const fields = listTasksQuerySchema.shape;

/**
 * Reads the list state field by field with the shared query schema, so one bad value (a
 * hand-edited `priority=URGENT`) falls back to its default instead of breaking the page.
 */
export function parseTaskListState(
  params: { get(name: string): string | null },
  defaults: TaskSortDefault,
): TaskListState {
  const raw = (name: string) => params.get(name) ?? undefined;
  const sort = fields.sort.safeParse(raw('sort') ?? defaults.sort).data ?? defaults.sort;
  const order = fields.order.safeParse(raw('order') ?? defaults.order).data ?? defaults.order;
  return {
    search: fields.search.safeParse(raw('search')).data ?? '',
    status: fields.status.safeParse(raw('status')).data ?? [],
    priority: fields.priority.safeParse(raw('priority')).data ?? [],
    due: fields.due.safeParse(raw('due')).data,
    sort,
    // `urgency` has one direction only.
    order: sort === 'urgency' ? 'asc' : order,
    page: fields.page.safeParse(raw('page')).data ?? 1,
    view: raw('view') === 'board' ? 'board' : 'list',
  };
}

/** Defaults are left out so the plain URL stays plain. */
export function serializeTaskListState(state: TaskListState, defaults: TaskSortDefault): string {
  const params = new URLSearchParams();
  if (state.view !== 'list') params.set('view', state.view);
  if (state.search !== '') params.set('search', state.search);
  if (state.status.length > 0) params.set('status', state.status.join(','));
  if (state.priority.length > 0) params.set('priority', state.priority.join(','));
  if (state.due !== undefined) params.set('due', state.due);
  if (state.sort !== defaults.sort) params.set('sort', state.sort);
  if (state.order !== defaults.order && state.sort !== 'urgency') params.set('order', state.order);
  if (state.page > 1 && state.view === 'list') params.set('page', String(state.page));
  return params.toString();
}

interface ParamsContext {
  projectId?: string;
  today: string;
}

export function toTaskListParams(state: TaskListState, context: ParamsContext): ListTasksParams {
  const board = state.view === 'board';
  return {
    projectId: context.projectId,
    search: state.search || undefined,
    status: state.status.length > 0 ? state.status : undefined,
    priority: state.priority.length > 0 ? state.priority : undefined,
    due: state.due,
    today: context.today,
    sort: state.sort,
    order: state.order,
    page: board ? 1 : state.page,
    limit: board ? BOARD_LIMIT : TASKS_PAGE_SIZE,
  };
}

export function hasTaskFilters(state: TaskListState): boolean {
  return (
    state.search !== '' ||
    state.status.length > 0 ||
    state.priority.length > 0 ||
    state.due !== undefined
  );
}

export const NO_TASK_FILTERS = {
  search: '',
  status: [],
  priority: [],
  due: undefined,
} satisfies Partial<TaskListState>;

interface UpdateOptions {
  /** Typing in search replaces the history entry; chips, sort, view and paging push one. */
  replace?: boolean;
}

/** Task list state in the URL (TECHNICAL_REQUIREMENTS §9), shared by the project page and `/tasks`. */
export function useTaskListState(defaults: TaskSortDefault) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const state = useMemo(() => parseTaskListState(searchParams, defaults), [searchParams, defaults]);

  /** Any change other than the page itself goes back to page 1. */
  const update = useCallback(
    (patch: Partial<TaskListState>, { replace = false }: UpdateOptions = {}) => {
      const query = new URLSearchParams(
        serializeTaskListState({ ...state, page: 1, ...patch }, defaults),
      );
      for (const name of DRAWER_PARAMS) {
        const value = searchParams.get(name);
        if (value !== null) query.set(name, value);
      }
      const url = query.size > 0 ? `${pathname}?${query.toString()}` : pathname;
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [state, defaults, searchParams, pathname, router],
  );

  return { state, update };
}
