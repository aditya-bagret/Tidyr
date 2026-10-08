'use client';

import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_STYLE,
  type PriorityStyle,
  type TaskPriority,
} from '@tidyr/shared';
import { cn } from 'cn';
import { ChevronsDownIcon, ChevronsUpIcon, EqualIcon, type LucideIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const ICONS: Record<PriorityStyle['icon'], LucideIcon> = {
  ChevronsUp: ChevronsUpIcon,
  Equal: EqualIcon,
  ChevronsDown: ChevronsDownIcon,
};

function Glyph({ priority }: { priority: TaskPriority }) {
  const { icon, color } = TASK_PRIORITY_STYLE[priority];
  const Icon = ICONS[icon];
  return <Icon className="size-4 shrink-0" style={{ color }} aria-hidden />;
}

interface PriorityIconProps {
  priority: TaskPriority;
  /** Compact rows show the icon only, with a tooltip (DESIGN §2.3). */
  showLabel?: boolean;
  onChange?: (priority: TaskPriority) => void;
  disabled?: boolean;
  className?: string;
}

export function PriorityIcon({
  priority,
  showLabel = false,
  onChange,
  disabled,
  className,
}: PriorityIconProps) {
  const label = TASK_PRIORITY_LABEL[priority];
  const classes = cn('inline-flex items-center gap-1 text-sm text-neutral-900', className);

  if (onChange) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          aria-label={`Priority: ${label}. Change priority`}
          className={cn(
            classes,
            'cursor-pointer rounded-sm px-1 hover:bg-neutral-100 disabled:opacity-50',
          )}
        >
          <Glyph priority={priority} />
          {showLabel ? label : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup
            value={priority}
            onValueChange={(value) => onChange(value as TaskPriority)}
          >
            {[...TASK_PRIORITIES].reverse().map((option) => (
              <DropdownMenuRadioItem key={option} value={option}>
                <Glyph priority={option} />
                {TASK_PRIORITY_LABEL[option]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (showLabel) {
    return (
      <span className={classes}>
        <Glyph priority={priority} />
        {label}
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span role="img" aria-label={`Priority: ${label}`} className={classes}>
          <Glyph priority={priority} />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label} priority</TooltipContent>
    </Tooltip>
  );
}
