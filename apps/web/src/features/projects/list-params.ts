'use client';

import {
  listProjectsQuerySchema,
  type ListProjectsParams,
  type ProjectSortField,
  type ProjectStatus,
  type SortOrder,
} from '@tidyr/shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/** 12 fills the 3 / 2 / 1-column grid (DESIGN §4.2) on every breakpoint. */
export const PROJECTS_PAGE_SIZE = 12;

export interface ProjectListState {
  search: string;
  status: ProjectStatus[];
  sort: ProjectSortField;
  order: SortOrder;
  page: number;
}

const fields = listProjectsQuerySchema.shape;
const DEFAULT_SORT = fields.sort.parse(undefined);
const DEFAULT_ORDER = fields.order.parse(undefined);

/**
 * Reads the list state from the URL with the shared query schema, field by field, so one bad
 * value (a hand-edited `status=DONE`) falls back to its default instead of breaking the page.
 */
export function parseProjectListState(params: {
  get(name: string): string | null;
}): ProjectListState {
  const raw = (name: string) => params.get(name) ?? undefined;
  return {
    search: fields.search.safeParse(raw('search')).data ?? '',
    status: fields.status.safeParse(raw('status')).data ?? [],
    sort: fields.sort.safeParse(raw('sort')).data ?? DEFAULT_SORT,
    order: fields.order.safeParse(raw('order')).data ?? DEFAULT_ORDER,
    page: fields.page.safeParse(raw('page')).data ?? 1,
  };
}

/** Defaults are left out so the plain `/projects` URL stays plain. */
export function serializeProjectListState(state: ProjectListState): string {
  const params = new URLSearchParams();
  if (state.search !== '') params.set('search', state.search);
  if (state.status.length > 0) params.set('status', state.status.join(','));
  if (state.sort !== DEFAULT_SORT) params.set('sort', state.sort);
  if (state.order !== DEFAULT_ORDER) params.set('order', state.order);
  if (state.page > 1) params.set('page', String(state.page));
  return params.toString();
}

export function toProjectListParams(state: ProjectListState): ListProjectsParams {
  return {
    search: state.search || undefined,
    status: state.status.length > 0 ? state.status : undefined,
    sort: state.sort,
    order: state.order,
    page: state.page,
    limit: PROJECTS_PAGE_SIZE,
  };
}

export function hasProjectFilters(state: ProjectListState): boolean {
  return state.search !== '' || state.status.length > 0;
}

interface UpdateOptions {
  /** Typing in search replaces the history entry; chips, sort and paging push one. */
  replace?: boolean;
}

/** The projects list state lives in the URL (TECHNICAL_REQUIREMENTS §9): refresh, back and share work. */
export function useProjectListState() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const state = useMemo(() => parseProjectListState(searchParams), [searchParams]);

  /** Any change other than the page itself goes back to page 1. */
  const update = useCallback(
    (patch: Partial<ProjectListState>, { replace = false }: UpdateOptions = {}) => {
      const query = serializeProjectListState({ ...state, page: 1, ...patch });
      const url = query ? `${pathname}?${query}` : pathname;
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [state, pathname, router],
  );

  return { state, update };
}
