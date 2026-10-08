'use client';

import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type Task,
  type TaskStatus,
  type UpdateTaskInput,
} from '@tidyr/shared';
import { cn } from 'cn';
import { ArrowRightLeftIcon } from 'lucide-react';
import { useEffect, useRef, type ComponentProps, type Ref } from 'react';
import { DueDate } from '@/components/due-date';
import { PriorityIcon } from '@/components/priority-icon';
import { TaskKey } from '@/components/task-key';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TaskCardProps extends Omit<ComponentProps<'div'>, 'onClick'> {
  task: Task;
  today: string;
  onOpen: (id: string) => void;
  onUpdate: (task: Task, patch: UpdateTaskInput) => void;
  /** The faded copy left in the column while its overlay is dragged. */
  placeholder?: boolean;
  /** The copy under the pointer while dragging. */
  overlay?: boolean;
  /** Moving by keyboard remounts the card in its new column; focus follows it there. */
  focusMoveMenu?: boolean;
  /** "Move to…" picked a column (the board tracks it for `focusMoveMenu`). */
  onMove?: (task: Task, status: TaskStatus) => void;
  ref?: Ref<HTMLDivElement>;
}

/**
 * DESIGN §3 TaskCard: name (3-line clamp), then key · priority · due. Dragging is wired by the
 * board; "Move to…" is the keyboard way to change columns (TSK-12, DESIGN §6).
 */
export function TaskCard({
  task,
  today,
  onOpen,
  onUpdate,
  placeholder = false,
  overlay = false,
  focusMoveMenu = false,
  onMove,
  className,
  ref,
  ...props
}: TaskCardProps) {
  const completed = task.status === 'COMPLETED';
  const moveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusMoveMenu) moveRef.current?.focus();
  }, [focusMoveMenu]);

  return (
    <div
      ref={ref}
      {...props}
      className={cn(
        'relative flex touch-manipulation flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-0 p-3 shadow-card select-none hover:border-neutral-400',
        placeholder && 'opacity-40',
        overlay && 'cursor-grabbing shadow-overlay',
        className,
      )}
    >
      {/* The button's ::after covers the card, so a click anywhere opens the drawer. */}
      <button
        type="button"
        onClick={() => onOpen(task.id)}
        className={cn(
          'line-clamp-3 pr-7 text-left text-sm break-words after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-brand-600',
          completed ? 'text-neutral-600 line-through' : 'text-neutral-900',
        )}
      >
        {task.name}
      </button>
      <MoveToMenu
        ref={moveRef}
        task={task}
        onMove={(status) => (onMove ? onMove(task, status) : onUpdate(task, { status }))}
      />
      <div className="flex items-center gap-2">
        <TaskKey value={task.key} className="relative z-10" />
        <PriorityIcon priority={task.priority} className="relative z-10" />
        <DueDate
          date={task.dueDate}
          status={task.status}
          today={today}
          className="ml-auto text-right"
        />
      </div>
    </div>
  );
}

interface MoveToMenuProps {
  task: Task;
  onMove: (status: TaskStatus) => void;
  ref: Ref<HTMLButtonElement>;
}

function MoveToMenu({ task, onMove, ref }: MoveToMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={ref}
          variant="ghost"
          size="icon-sm"
          aria-label={`Move ${task.key} to…`}
          className="absolute top-1.5 right-1.5 z-10 size-7 text-neutral-600"
        >
          <ArrowRightLeftIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Move to…</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={task.status}
          onValueChange={(value) => onMove(value as TaskStatus)}
        >
          {TASK_STATUSES.map((status) => (
            <DropdownMenuRadioItem key={status} value={status}>
              {TASK_STATUS_LABEL[status]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
