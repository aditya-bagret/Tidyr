import { formatDate, todayLocal } from '@tidyr/shared';
import { cn } from 'cn';
import { CalendarIcon } from 'lucide-react';

interface ProjectDatesProps {
  startDate: string | null;
  endDate: string | null;
  today?: string;
  className?: string;
}

/** "Sep 23 → Nov 6", "Starts Sep 23", "Ends Nov 6" or "No dates" (DESIGN §4.2). */
export function ProjectDates({
  startDate,
  endDate,
  today = todayLocal(),
  className,
}: ProjectDatesProps) {
  let content;
  if (startDate && endDate) {
    content = (
      <>
        <time dateTime={startDate}>{formatDate(startDate, today)}</time>
        <span aria-hidden>→</span>
        <span className="sr-only">to</span>
        <time dateTime={endDate}>{formatDate(endDate, today)}</time>
      </>
    );
  } else if (startDate) {
    content = (
      <>
        Starts <time dateTime={startDate}>{formatDate(startDate, today)}</time>
      </>
    );
  } else if (endDate) {
    content = (
      <>
        Ends <time dateTime={endDate}>{formatDate(endDate, today)}</time>
      </>
    );
  } else {
    content = <span className="italic">No dates</span>;
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm text-neutral-600', className)}>
      <CalendarIcon className="size-4 shrink-0 text-neutral-400" aria-hidden />
      {content}
    </span>
  );
}
