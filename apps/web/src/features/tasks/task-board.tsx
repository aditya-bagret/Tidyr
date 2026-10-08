'use client';

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type Task,
  type TaskStatus,
  type UpdateTaskInput,
} from '@tidyr/shared';
import { cn } from 'cn';
import { useMemo, useState } from 'react';
import { TaskCard } from './task-card';

interface TaskBoardProps {
  tasks: readonly Task[];
  today: string;
  onOpen: (id: string) => void;
  onUpdate: (task: Task, patch: UpdateTaskInput) => void;
}

const isStatus = (id: UniqueIdentifier | undefined): id is TaskStatus =>
  TASK_STATUSES.some((status) => status === id);

/**
 * DESIGN §3 TaskBoard (TSK-12): Pending / In Progress / Completed columns. Dragging a card to
 * another column changes its status (optimistic, via `onUpdate`); each card's "Move to…" menu is
 * the keyboard alternative, so there's no keyboard drag sensor.
 */
export function TaskBoard({ tasks, today, onOpen, onUpdate }: TaskBoardProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [movedByMenu, setMovedByMenu] = useState<string | null>(null);
  // A small distance keeps clicks as clicks; touch waits for a press so the board still scrolls.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  const columns = useMemo(
    () =>
      TASK_STATUSES.map((status) => ({
        status,
        tasks: tasks.filter((task) => task.status === status),
      })),
    [tasks],
  );
  const byId = (id: UniqueIdentifier | undefined) => tasks.find((task) => task.id === id);
  const active = byId(activeId ?? undefined);

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${byId(active.id)?.key ?? 'task'}.`,
    onDragOver: ({ over }) =>
      isStatus(over?.id) ? `Over ${TASK_STATUS_LABEL[over.id]}.` : undefined,
    onDragEnd: ({ active, over }) =>
      isStatus(over?.id)
        ? `Moved ${byId(active.id)?.key ?? 'task'} to ${TASK_STATUS_LABEL[over.id]}.`
        : 'Not moved.',
    onDragCancel: () => 'Not moved.',
  };

  function moveByMenu(task: Task, status: TaskStatus) {
    setMovedByMenu(task.id);
    if (status !== task.status) onUpdate(task, { status });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const task = byId(active.id);
    if (task && isStatus(over?.id) && over.id !== task.status) {
      onUpdate(task, { status: over.id });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      accessibility={{ announcements }}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {/* Below 768 px the columns scroll sideways (APP_FLOW §7). */}
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {columns.map((column) => (
          <BoardColumn
            key={column.status}
            status={column.status}
            tasks={column.tasks}
            today={today}
            onOpen={onOpen}
            onUpdate={onUpdate}
            onMove={moveByMenu}
            movedByMenu={movedByMenu}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? (
          <TaskCard task={active} today={today} onOpen={onOpen} onUpdate={onUpdate} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface BoardColumnProps extends Omit<TaskBoardProps, 'tasks'> {
  status: TaskStatus;
  tasks: readonly Task[];
  onMove: (task: Task, status: TaskStatus) => void;
  movedByMenu: string | null;
}

function BoardColumn({
  status,
  tasks,
  today,
  onOpen,
  onUpdate,
  onMove,
  movedByMenu,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const headingId = `board-column-${status}`;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={cn(
        'flex w-72 shrink-0 snap-start flex-col rounded-md bg-neutral-100 transition-shadow md:w-auto',
        isOver && 'ring-2 ring-brand-600',
      )}
    >
      <h3
        id={headingId}
        className="flex items-center gap-2 px-3 pt-3 pb-1 text-xs font-semibold tracking-wide text-neutral-600 uppercase"
      >
        {TASK_STATUS_LABEL[status]}
        <span className="font-normal tabular-nums">{tasks.length}</span>
      </h3>
      <ul className="flex min-h-24 flex-1 flex-col gap-2 p-2">
        {tasks.map((task) => (
          <li key={task.id}>
            <DraggableCard
              task={task}
              today={today}
              onOpen={onOpen}
              onUpdate={onUpdate}
              onMove={onMove}
              focusMoveMenu={movedByMenu === task.id}
            />
          </li>
        ))}
        {tasks.length === 0 ? (
          <li className="px-2 py-6 text-center text-sm text-neutral-600">No tasks</li>
        ) : null}
      </ul>
    </section>
  );
}

interface DraggableCardProps {
  task: Task;
  today: string;
  onOpen: (id: string) => void;
  onUpdate: (task: Task, patch: UpdateTaskInput) => void;
  onMove: (task: Task, status: TaskStatus) => void;
  focusMoveMenu: boolean;
}

function DraggableCard(props: DraggableCardProps) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: props.task.id });
  // Only the pointer listeners: the keyboard path is "Move to…", so dnd-kit's keyboard
  // attributes (role, tabIndex, drag instructions) would announce something that doesn't work.
  return <TaskCard ref={setNodeRef} {...listeners} {...props} placeholder={isDragging} />;
}
