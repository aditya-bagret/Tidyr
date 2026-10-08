'use client';

import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from '@tidyr/shared';
import type { Ref } from 'react';
import type { FieldControlProps } from '@/components/form-field';
import { PriorityIcon } from '@/components/priority-icon';
import { StatusBadge } from '@/components/status-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EnumSelectProps<T extends string> extends FieldControlProps {
  value: T;
  onChange: (value: T) => void;
  onBlur?: () => void;
  ref?: Ref<HTMLButtonElement>;
}

/** The drawer's Status control: options are the lozenges themselves (DESIGN §2.2). */
export function TaskStatusSelect({
  value,
  onChange,
  onBlur,
  ref,
  ...field
}: EnumSelectProps<TaskStatus>) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as TaskStatus)}>
      <SelectTrigger ref={ref} onBlur={onBlur} className="w-full" {...field}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TASK_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            <StatusBadge kind="task" status={status} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The drawer's Priority control: icon plus label, High first (DESIGN §2.3). */
export function TaskPrioritySelect({
  value,
  onChange,
  onBlur,
  ref,
  ...field
}: EnumSelectProps<TaskPriority>) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as TaskPriority)}>
      <SelectTrigger ref={ref} onBlur={onBlur} className="w-full" {...field}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {[...TASK_PRIORITIES].reverse().map((priority) => (
          <SelectItem key={priority} value={priority}>
            <PriorityIcon priority={priority} showLabel />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
