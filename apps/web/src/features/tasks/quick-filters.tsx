'use client';

import type { TaskDueFilter, TaskPriority } from '@tidyr/shared';
import { CheckIcon } from 'lucide-react';
import { chipClassName } from '@/components/filter-chips';

/** `due` values with no chip of their own still need a visible, removable chip when in the URL. */
const OTHER_DUE_LABEL: Partial<Record<TaskDueFilter, string>> = {
  today: 'Due today',
  none: 'No due date',
};

interface QuickFiltersProps {
  due: TaskDueFilter | undefined;
  priority: readonly TaskPriority[];
  onDueChange: (due: TaskDueFilter | undefined) => void;
  onPriorityChange: (priority: TaskPriority[]) => void;
}

/** DESIGN §3 QuickFilters: Overdue · Due this week · High priority (APP_FLOW F8). Each chip toggles a preset. */
export function QuickFilters({ due, priority, onDueChange, onPriorityChange }: QuickFiltersProps) {
  const highOnly = priority.length === 1 && priority[0] === 'HIGH';
  const otherDue = due ? OTHER_DUE_LABEL[due] : undefined;
  const chips = [
    {
      label: 'Overdue',
      pressed: due === 'overdue',
      toggle: () => onDueChange(due === 'overdue' ? undefined : 'overdue'),
    },
    {
      label: 'Due this week',
      pressed: due === 'week',
      toggle: () => onDueChange(due === 'week' ? undefined : 'week'),
    },
    {
      label: 'High priority',
      pressed: highOnly,
      toggle: () => onPriorityChange(highOnly ? [] : ['HIGH']),
    },
    ...(otherDue ? [{ label: otherDue, pressed: true, toggle: () => onDueChange(undefined) }] : []),
  ];

  return (
    <div role="group" aria-label="Quick filters" className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          aria-pressed={chip.pressed}
          onClick={chip.toggle}
          className={chipClassName(chip.pressed)}
        >
          {chip.pressed ? <CheckIcon className="size-3.5" aria-hidden /> : null}
          {chip.label}
        </button>
      ))}
    </div>
  );
}
