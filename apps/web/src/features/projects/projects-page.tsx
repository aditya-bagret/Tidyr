'use client';

import { PROJECT_STATUSES, PROJECT_STATUS_LABEL, todayLocal } from '@tidyr/shared';
import { FolderKanbanIcon, PlusIcon, SearchXIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Banner } from '@/components/banner';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { FilterChips } from '@/components/filter-chips';
import { Pagination } from '@/components/pagination';
import { RefreshButton } from '@/components/refresh-button';
import { SearchInput } from '@/components/search-input';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/errors';
import { useShortcuts } from '@/lib/use-shortcuts';
import { hasProjectFilters, toProjectListParams, useProjectListState } from './list-params';
import { ProjectCard, ProjectCardSkeleton } from './project-card';
import { ProjectFormDialog } from './project-form-dialog';
import { ProjectSortSelect } from './project-sort-select';
import { useProjects } from './queries';

const STATUS_OPTIONS = PROJECT_STATUSES.map((value) => ({
  value,
  label: PROJECT_STATUS_LABEL[value],
}));

const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';

/** DESIGN §4.2 / APP_FLOW F8: search, status chips, sort and paging, all in the URL. */
export function ProjectsPage() {
  const { state, update } = useProjectListState();
  const query = useProjects(toProjectListParams(state));
  const [creating, setCreating] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  useShortcuts({ '/': () => searchRef.current?.focus() });
  const filtered = hasProjectFilters(state);
  const today = todayLocal();
  const { data, isPlaceholderData } = query;

  // Deleting the last project on the last page (or a stale ?page=9 link) lands past the end:
  // step back to the real last page.
  const lastPage = data?.meta.totalPages ?? 0;
  const pastTheEnd = data !== undefined && !isPlaceholderData && state.page > Math.max(lastPage, 1);
  useEffect(() => {
    if (pastTheEnd) update({ page: Math.max(lastPage, 1) }, { replace: true });
  }, [pastTheEnd, lastPage, update]);

  function clearFilters() {
    update({ search: '', status: [] });
  }

  let content;
  if (query.isPending) {
    content = (
      <div className={GRID} aria-busy>
        {Array.from({ length: 6 }, (_, index) => (
          <ProjectCardSkeleton key={index} />
        ))}
        <span className="sr-only">Loading projects…</span>
      </div>
    );
  } else if (query.isError && !data) {
    content = (
      <ErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        className="rounded-md border border-neutral-200 bg-neutral-0"
      />
    );
  } else if (data && data.data.length === 0 && !pastTheEnd) {
    content = filtered ? (
      <EmptyState
        icon={SearchXIcon}
        title="No projects match your filters."
        action={
          <Button variant="secondary" onClick={clearFilters}>
            Clear filters
          </Button>
        }
        className="rounded-md border border-neutral-200 bg-neutral-0"
      />
    ) : (
      <EmptyState
        icon={FolderKanbanIcon}
        title="No projects yet."
        description="Create your first project to start organizing tasks."
        action={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon aria-hidden />
            New project
          </Button>
        }
        className="rounded-md border border-neutral-200 bg-neutral-0"
      />
    );
  } else if (data) {
    content = (
      <>
        <ul className={GRID}>
          {data.data.map((project) => (
            <li key={project.id} className="flex">
              <ProjectCard project={project} today={today} />
            </li>
          ))}
        </ul>
        <Pagination meta={data.meta} noun="project" onPageChange={(page) => update({ page })} />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          ref={searchRef}
          shortcutHint
          value={state.search}
          onChange={(search) => update({ search }, { replace: true })}
          label="Search projects"
          placeholder="Search projects…"
          className="sm:max-w-xs"
        />
        <div className="flex items-center gap-2 sm:ml-auto">
          <ProjectSortSelect
            sort={state.sort}
            order={state.order}
            onChange={(sort, order) => update({ sort, order })}
            className="min-w-0 flex-1 sm:w-48 sm:flex-none"
          />
          <RefreshButton
            onRefresh={() => void query.refetch()}
            refreshing={query.isFetching && !query.isPending}
          />
          <Button onClick={() => setCreating(true)}>
            <PlusIcon aria-hidden />
            {/* One flex item, so the button's gap doesn't widen the space between the words. */}
            <span>
              New<span className="max-sm:sr-only"> project</span>
            </span>
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FilterChips
          label="Filter by status"
          options={STATUS_OPTIONS}
          selected={state.status}
          onChange={(status) => update({ status })}
        />
        {filtered ? (
          <Button variant="link" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>
      {query.isRefetchError && data ? (
        <Banner tone="warning">Couldn&apos;t refresh the list. {errorMessage(query.error)}</Banner>
      ) : null}
      {content}
      <ProjectFormDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
