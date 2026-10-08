'use client';

import {
  formatDate,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  todayLocal,
  type ActivityEntry,
  type FieldChange,
} from '@tidyr/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/errors';
import { useTaskActivity } from './queries';

const FIELD_LABEL: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  priority: 'Priority',
  status: 'Status',
  dueDate: 'Due date',
};

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function when(iso: string, today: string): string {
  const date = new Date(iso);
  return `${formatDate(todayLocal(date), today)}, ${timeFormat.format(date)}`;
}

function show(field: string, value: unknown, today: string): string {
  if (value === null || value === undefined || value === '') return 'none';
  // Audited task fields are all strings or null (API_CONTRACT §8).
  if (typeof value !== 'string') return 'unknown';
  const status = TASK_STATUSES.find((item) => item === value);
  if (field === 'status' && status) return TASK_STATUS_LABEL[status];
  const priority = TASK_PRIORITIES.find((item) => item === value);
  if (field === 'priority' && priority) return TASK_PRIORITY_LABEL[priority];
  if (field === 'dueDate') return formatDate(value, today);
  return `"${value}"`;
}

function describe(field: string, change: FieldChange, today: string): string {
  const label = FIELD_LABEL[field] ?? field;
  // Descriptions are long (and stored truncated); the fact that it changed is what matters.
  if (field === 'description') return `${label} updated`;
  return `${label}: ${show(field, change.from, today)} → ${show(field, change.to, today)}`;
}

function lines(entry: ActivityEntry, today: string): string[] {
  if (entry.action === 'CREATED') return ['Created the task'];
  if (entry.action === 'DELETED') return ['Deleted the task'];
  return Object.entries(entry.changes ?? {}).map(([field, change]) =>
    describe(field, change, today),
  );
}

/** P10.7 / BON-08: the task's history, newest first (DESIGN §4.3). */
export function TaskActivity({ id }: { id: string }) {
  const query = useTaskActivity(id);
  const today = todayLocal();

  return (
    <section aria-labelledby="task-activity" className="flex flex-col gap-3">
      <h3
        id="task-activity"
        className="border-t border-neutral-200 pt-4 text-sm font-semibold text-neutral-900"
      >
        Activity
      </h3>
      {query.isPending ? (
        <div className="flex flex-col gap-2" aria-busy>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : query.isError ? (
        <p className="text-sm text-neutral-600">
          Couldn&apos;t load the activity. {errorMessage(query.error)}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {query.data.data.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-0.5 text-sm">
              {lines(entry, today).map((line) => (
                <span key={line} className="text-neutral-900">
                  {line}
                </span>
              ))}
              <time dateTime={entry.createdAt} className="text-xs text-neutral-600">
                {when(entry.createdAt, today)}
              </time>
            </li>
          ))}
          {query.data.meta.total > query.data.data.length ? (
            <li className="text-xs text-neutral-600">
              Showing the latest {query.data.data.length} of {query.data.meta.total} changes.
            </li>
          ) : null}
        </ol>
      )}
    </section>
  );
}
