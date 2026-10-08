'use client';

import type { Task, UpdateTaskInput } from '@tidyr/shared';
import { cn } from 'cn';
import { DueDate } from '@/components/due-date';
import { PriorityIcon } from '@/components/priority-icon';
import { StatusBadge } from '@/components/status-badge';
import { TaskKey } from '@/components/task-key';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';

interface TaskRowProps {
  task: Task;
  today: string;
  onOpen: (id: string) => void;
  onUpdate: (task: Task, patch: UpdateTaskInput) => void;
  /** My Tasks spans projects, so it names each row's project. */
  showProject?: boolean;
}

/** DESIGN §3: `[✓] [key] name ……… [priority] [status] [due]`. */
export function TaskRow({ task, today, onOpen, onUpdate, showProject = false }: TaskRowProps) {
  const completed = task.status === 'COMPLETED';

  return (
    <li className="relative flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 sm:items-center sm:py-2.5">
      <Checkbox
        checked={completed}
        // TSK-06: one action completes; unticking reopens it as Pending.
        onCheckedChange={(checked) =>
          onUpdate(task, { status: checked === true ? 'COMPLETED' : 'PENDING' })
        }
        aria-label={completed ? `Reopen ${task.key}` : `Mark ${task.key} complete`}
        className="z-10 mt-0.5 sm:mt-0"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-baseline gap-2 sm:items-center">
            <TaskKey value={task.key} className="relative z-10" />
            {/* The button's ::after covers the row, so a click anywhere opens the drawer. */}
            <button
              type="button"
              onClick={() => onOpen(task.id)}
              className={cn(
                'min-w-0 truncate text-left text-sm after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:rounded-sm focus-visible:after:ring-2 focus-visible:after:ring-brand-600 focus-visible:after:ring-inset',
                completed ? 'text-neutral-600 line-through' : 'text-neutral-900',
              )}
            >
              {task.name}
            </button>
          </div>
          {/* Below 1024 px a project column would squeeze the name, so it goes underneath. */}
          {showProject ? <ProjectName name={task.project.name} className="lg:hidden" /> : null}
        </div>
        <div className="flex items-center gap-3 sm:shrink-0">
          {showProject ? (
            <ProjectName name={task.project.name} className="hidden w-40 text-right lg:block" />
          ) : null}
          <PriorityIcon
            priority={task.priority}
            onChange={(priority) => onUpdate(task, { priority })}
            className="relative z-10"
          />
          {/* Fixed widths keep statuses and due dates in columns, whatever their length. */}
          <span className="sm:w-28">
            <StatusBadge
              kind="task"
              status={task.status}
              onChange={(status) => onUpdate(task, { status })}
              className="relative z-10"
            />
          </span>
          <span className="whitespace-nowrap sm:w-36 sm:text-right">
            <DueDate date={task.dueDate} status={task.status} today={today} />
          </span>
        </div>
      </div>
    </li>
  );
}

function ProjectName({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('truncate text-xs text-neutral-600', className)} title={name}>
      {name}
    </span>
  );
}

export function TaskRowSkeleton() {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="size-4" />
      <Skeleton className="h-4 w-14" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="hidden h-4 w-40 sm:block" />
    </li>
  );
}
