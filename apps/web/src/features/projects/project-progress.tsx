import type { TaskCounts } from '@tidyr/shared';
import { cn } from 'cn';
import { ProgressBar } from '@/components/progress-bar';

/** Completed / total tasks as a bar and "7/12 tasks" (PRJ-10). */
export function ProjectProgress({ counts, className }: { counts: TaskCounts; className?: string }) {
  const { completed, total } = counts;
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <ProgressBar
        value={completed}
        max={total}
        label={`${completed} of ${total} tasks completed`}
        className="flex-1"
      />
      <span className="shrink-0 text-xs text-neutral-600 tabular-nums">
        {completed}/{total} {total === 1 ? 'task' : 'tasks'}
      </span>
    </div>
  );
}
