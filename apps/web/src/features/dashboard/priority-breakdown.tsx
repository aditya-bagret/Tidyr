import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_STYLE,
  type TaskPriority,
} from '@tidyr/shared';
import Link from 'next/link';
import { PriorityIcon } from '@/components/priority-icon';

interface PriorityBreakdownProps {
  counts: Record<TaskPriority, number>;
  total: number;
}

/** "Tasks by priority" bars (DSH-03). Each row links to that priority's tasks. */
export function PriorityBreakdown({ counts, total }: PriorityBreakdownProps) {
  return (
    <section
      aria-labelledby="dashboard-priority"
      className="rounded-md border border-neutral-200 bg-neutral-0 shadow-card"
    >
      <div className="flex min-h-12 items-center border-b border-neutral-200 px-4 py-2">
        <h2 id="dashboard-priority" className="text-sm font-semibold text-neutral-900">
          Tasks by priority
        </h2>
      </div>
      <ul className="flex flex-col gap-1 p-2">
        {[...TASK_PRIORITIES].reverse().map((priority) => {
          const count = counts[priority];
          const percent = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <li key={priority}>
              <Link
                href={`/tasks?priority=${priority}`}
                aria-label={`${TASK_PRIORITY_LABEL[priority]} priority: ${count} ${count === 1 ? 'task' : 'tasks'}`}
                className="grid min-h-11 grid-cols-[5.5rem_1fr_2.5rem] items-center gap-3 rounded-md px-2 hover:bg-neutral-50"
              >
                <PriorityIcon priority={priority} showLabel />
                <span className="h-2 overflow-hidden rounded-full bg-neutral-100" aria-hidden>
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${percent}%`,
                      background: TASK_PRIORITY_STYLE[priority].color,
                    }}
                  />
                </span>
                <span className="text-right text-sm font-semibold text-neutral-900 tabular-nums">
                  {count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
