'use client';

import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_STYLE,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  TASK_STATUS_STYLE,
  type LozengeStyle,
  type ProjectStatus,
  type TaskStatus,
} from '@tidyr/shared';
import { cn } from 'cn';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LozengeConfig<S extends string> {
  statuses: readonly S[];
  labels: Record<S, string>;
  styles: Record<S, LozengeStyle>;
}

const PROJECT: LozengeConfig<ProjectStatus> = {
  statuses: PROJECT_STATUSES,
  labels: PROJECT_STATUS_LABEL,
  styles: PROJECT_STATUS_STYLE,
};

const TASK: LozengeConfig<TaskStatus> = {
  statuses: TASK_STATUSES,
  labels: TASK_STATUS_LABEL,
  styles: TASK_STATUS_STYLE,
};

const LOZENGE =
  'inline-flex h-5 items-center gap-1 rounded-sm px-1.5 text-[11px] leading-none font-semibold tracking-wide whitespace-nowrap uppercase';

interface LozengeProps<S extends string> {
  config: LozengeConfig<S>;
  status: S;
  onChange?: (status: S) => void;
  disabled?: boolean;
  className?: string;
}

function Lozenge<S extends string>({
  config,
  status,
  onChange,
  disabled,
  className,
}: LozengeProps<S>) {
  const { background, text } = config.styles[status];
  const label = config.labels[status];
  const content = (
    <>
      {label}
      {status === 'COMPLETED' ? <CheckIcon className="size-3" aria-hidden /> : null}
    </>
  );

  if (!onChange) {
    return (
      <span className={cn(LOZENGE, className)} style={{ background, color: text }}>
        {content}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={`Status: ${label}. Change status`}
        className={cn(LOZENGE, 'cursor-pointer hover:brightness-95 disabled:opacity-50', className)}
        style={{ background, color: text }}
      >
        {content}
        <ChevronDownIcon className="size-3" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={status} onValueChange={(value) => onChange(value as S)}>
          {config.statuses.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {config.labels[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type StatusBadgeProps =
  | {
      kind: 'project';
      status: ProjectStatus;
      onChange?: (status: ProjectStatus) => void;
      disabled?: boolean;
      className?: string;
    }
  | {
      kind: 'task';
      status: TaskStatus;
      onChange?: (status: TaskStatus) => void;
      disabled?: boolean;
      className?: string;
    };

/** Status lozenge (DESIGN §2.2): always a text label, never colour alone. `onChange` makes it a menu. */
export function StatusBadge(props: StatusBadgeProps) {
  if (props.kind === 'project') {
    const { kind: _kind, ...rest } = props;
    return <Lozenge config={PROJECT} {...rest} />;
  }
  const { kind: _kind, ...rest } = props;
  return <Lozenge config={TASK} {...rest} />;
}
