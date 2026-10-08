'use client';

import { cn } from 'cn';
import { KanbanIcon, ListIcon, type LucideIcon } from 'lucide-react';
import type { TaskView } from './list-params';

const VIEWS: readonly { value: TaskView; label: string; icon: LucideIcon }[] = [
  { value: 'list', label: 'List', icon: ListIcon },
  { value: 'board', label: 'Board', icon: KanbanIcon },
];

/** List | Board (DESIGN §4.3); the choice lives in the URL (`?view=board`). */
export function ViewToggle({
  view,
  onChange,
}: {
  view: TaskView;
  onChange: (view: TaskView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex rounded-md border border-neutral-200 bg-neutral-0 p-0.5"
    >
      {VIEWS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => onChange(value)}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-sm font-medium transition-colors',
            view === value
              ? 'bg-brand-50 text-brand-700'
              : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
