import { formatDate, formatDue, isOverdue, todayLocal, type TaskStatus } from '@tidyr/shared';
import { cn } from 'cn';
import { AlertCircleIcon } from 'lucide-react';

interface DueDateProps {
  date: string | null;
  status: TaskStatus;
  /** The device's local date (D-009); pass it down so a list uses one value. */
  today?: string;
  className?: string;
}

/** "Oct 20", "Today", "Tomorrow", or "Overdue · Oct 2" in red with an icon (DESIGN §3). */
export function DueDate({ date, status, today = todayLocal(), className }: DueDateProps) {
  if (date === null) return null;

  if (isOverdue({ dueDate: date, status }, today)) {
    return (
      <time
        dateTime={date}
        className={cn(
          'inline-flex items-center gap-1 text-xs font-medium text-danger-600',
          className,
        )}
      >
        <AlertCircleIcon className="size-3.5 shrink-0" aria-hidden />
        Overdue · {formatDate(date, today)}
      </time>
    );
  }

  return (
    <time dateTime={date} className={cn('text-xs text-neutral-600', className)}>
      {formatDue(date, today)}
    </time>
  );
}
