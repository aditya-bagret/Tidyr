'use client';

import type { SortOrder, TaskSortField } from '@tidyr/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// TSK-14: created date, due date (empty dates last), priority or name; plus My Tasks' default.
const OPTIONS: readonly { sort: TaskSortField; order: SortOrder; label: string }[] = [
  { sort: 'urgency', order: 'asc', label: 'Overdue first' },
  { sort: 'createdAt', order: 'desc', label: 'Newest' },
  { sort: 'createdAt', order: 'asc', label: 'Oldest' },
  { sort: 'updatedAt', order: 'desc', label: 'Recently updated' },
  { sort: 'dueDate', order: 'asc', label: 'Due date, soonest' },
  { sort: 'dueDate', order: 'desc', label: 'Due date, latest' },
  { sort: 'priority', order: 'desc', label: 'Priority, highest' },
  { sort: 'priority', order: 'asc', label: 'Priority, lowest' },
  { sort: 'name', order: 'asc', label: 'Name A–Z' },
  { sort: 'name', order: 'desc', label: 'Name Z–A' },
];

const valueOf = (sort: TaskSortField, order: SortOrder) => `${sort}:${order}`;

interface TaskSortSelectProps {
  sort: TaskSortField;
  order: SortOrder;
  onChange: (sort: TaskSortField, order: SortOrder) => void;
  className?: string;
}

export function TaskSortSelect({ sort, order, onChange, className }: TaskSortSelectProps) {
  return (
    <Select
      value={valueOf(sort, order)}
      onValueChange={(value) => {
        const option = OPTIONS.find((item) => valueOf(item.sort, item.order) === value);
        if (option) onChange(option.sort, option.order);
      }}
    >
      <SelectTrigger aria-label="Sort tasks" className={className}>
        <span className="text-neutral-600">Sort:</span>
        {/* Grows so the value sits next to "Sort:" rather than centred in a wide trigger (Radix
            drops a className on SelectValue itself). */}
        <span className="flex-1 text-left">
          <SelectValue placeholder="Custom" />
        </span>
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {OPTIONS.map((option) => (
          <SelectItem
            key={valueOf(option.sort, option.order)}
            value={valueOf(option.sort, option.order)}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
