'use client';

import type { ProjectSortField, SortOrder } from '@tidyr/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// PRJ-08: created date, name or end date, either direction (+ recently updated).
const OPTIONS: readonly { sort: ProjectSortField; order: SortOrder; label: string }[] = [
  { sort: 'createdAt', order: 'desc', label: 'Newest' },
  { sort: 'createdAt', order: 'asc', label: 'Oldest' },
  { sort: 'updatedAt', order: 'desc', label: 'Recently updated' },
  { sort: 'name', order: 'asc', label: 'Name A–Z' },
  { sort: 'name', order: 'desc', label: 'Name Z–A' },
  { sort: 'endDate', order: 'asc', label: 'End date, soonest' },
  { sort: 'endDate', order: 'desc', label: 'End date, latest' },
];

const valueOf = (sort: ProjectSortField, order: SortOrder) => `${sort}:${order}`;

interface ProjectSortSelectProps {
  sort: ProjectSortField;
  order: SortOrder;
  onChange: (sort: ProjectSortField, order: SortOrder) => void;
  className?: string;
}

export function ProjectSortSelect({ sort, order, onChange, className }: ProjectSortSelectProps) {
  return (
    <Select
      value={valueOf(sort, order)}
      onValueChange={(value) => {
        const option = OPTIONS.find((item) => valueOf(item.sort, item.order) === value);
        if (option) onChange(option.sort, option.order);
      }}
    >
      <SelectTrigger aria-label="Sort projects" className={className}>
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
