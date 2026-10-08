'use client';

import { cn } from 'cn';
import type { MouseEvent } from 'react';
import { toast } from 'sonner';

/** `WEB-12` in mono; clicking copies it (DESIGN §3). */
export function TaskKey({ value, className }: { value: string; className?: string }) {
  async function copy(event: MouseEvent<HTMLButtonElement>) {
    // Keys sit inside clickable rows and cards; copying shouldn't also open the task.
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Copied ${value}`);
    } catch {
      toast.error(`Couldn't copy ${value}`);
    }
  }

  return (
    <button
      type="button"
      onClick={(event) => void copy(event)}
      title="Copy key"
      aria-label={`${value}, copy key`}
      className={cn(
        'shrink-0 rounded-sm font-mono text-xs text-neutral-600 tabular-nums hover:text-brand-700 hover:underline',
        className,
      )}
    >
      {value}
    </button>
  );
}
