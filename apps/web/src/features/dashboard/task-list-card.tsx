import type { Task } from '@tidyr/shared';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { DueDate } from '@/components/due-date';
import { PriorityIcon } from '@/components/priority-icon';
import { Skeleton } from '@/components/ui/skeleton';

interface TaskListCardProps {
  id: string;
  title: string;
  count?: number;
  tasks: readonly Task[];
  today: string;
  emptyText: string;
  action?: ReactNode;
}

/** A dashboard section listing up to 5 tasks: key, name, priority and due date (DESIGN §4.1). */
export function TaskListCard({
  id,
  title,
  count,
  tasks,
  today,
  emptyText,
  action,
}: TaskListCardProps) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-md border border-neutral-200 bg-neutral-0 shadow-card"
    >
      <div className="flex min-h-12 items-center justify-between gap-2 border-b border-neutral-200 px-4 py-2">
        <h2 id={id} className="text-sm font-semibold text-neutral-900">
          {title}
          {count !== undefined ? (
            <span className="ml-1.5 font-normal text-neutral-600 tabular-nums">({count})</span>
          ) : null}
        </h2>
        {action}
      </div>
      {tasks.length > 0 ? (
        <ul className="divide-y divide-neutral-200">
          {tasks.map((task) => (
            <li key={task.id}>
              {/* Opens the task drawer on its project page (APP_FLOW §1, `?task=`). */}
              <Link
                href={`/projects/${task.projectId}?task=${task.id}`}
                className="flex min-h-11 items-center gap-3 px-4 py-2 hover:bg-neutral-50"
              >
                <span className="shrink-0 font-mono text-xs text-neutral-600 tabular-nums">
                  {task.key}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-900">
                  {task.name}
                </span>
                <PriorityIcon priority={task.priority} />
                <DueDate
                  date={task.dueDate}
                  status={task.status}
                  today={today}
                  className="shrink-0 text-right"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-6 text-sm text-neutral-600">{emptyText}</p>
      )}
    </section>
  );
}

export function TaskListCardSkeleton() {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-0 shadow-card">
      <div className="border-b border-neutral-200 px-4 py-4">
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex flex-col gap-4 p-4">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}
