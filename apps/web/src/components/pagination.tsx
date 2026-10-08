import type { PageMeta } from '@tidyr/shared';
import { cn } from 'cn';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  meta: PageMeta;
  onPageChange: (page: number) => void;
  /** Singular noun for the count, e.g. "project" → "57 projects". */
  noun?: string;
  className?: string;
}

/** Prev / Next + "Page 2 of 5 · 57 items" (DESIGN §3). */
export function Pagination({ meta, onPageChange, noun = 'item', className }: PaginationProps) {
  const { page, totalPages, total } = meta;
  if (total === 0) return null;
  const count = `${total} ${total === 1 ? noun : `${noun}s`}`;

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex flex-wrap items-center justify-between gap-3', className)}
    >
      <p className="text-sm text-neutral-600" aria-live="polite">
        {totalPages > 1 ? `Page ${page} of ${totalPages} · ${count}` : count}
      </p>
      {totalPages > 1 ? (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeftIcon aria-hidden />
            Prev
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
            <ChevronRightIcon aria-hidden />
          </Button>
        </div>
      ) : null}
    </nav>
  );
}
