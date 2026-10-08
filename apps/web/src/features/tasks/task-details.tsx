'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  formatDate,
  isApiError,
  taskFormSchema,
  todayLocal,
  uuid,
  type Task,
  type TaskFormValues,
} from '@tidyr/shared';
import { FileXIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { FormField } from '@/components/form-field';
import { TaskKey } from '@/components/task-key';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage } from '@/lib/errors';
import { isChange, useDeleteTask, useTask, useUpdateTask } from './queries';
import { TaskActivity } from './task-activity';
import { TaskPrioritySelect, TaskStatusSelect } from './task-selects';

interface TaskDetailsProps {
  id: string;
  onDirtyChange: (dirty: boolean) => void;
  onClose: () => void;
}

/** `?task=<id>`: view and edit one task (APP_FLOW F6), its activity (BON-08), and delete. */
export function TaskDetails({ id, onDirtyChange, onClose }: TaskDetailsProps) {
  // A malformed id can't exist; skip the request, as the project page does (D-037).
  const validId = uuid.safeParse(id).success;
  const query = useTask(id, validId);

  if (!validId || (isApiError(query.error) && query.error.status === 404)) {
    return (
      <>
        <DrawerTitle title="Task not found" />
        <EmptyState
          icon={FileXIcon}
          title="This task doesn't exist or you don't have access to it."
          action={
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          }
        />
      </>
    );
  }
  if (query.isPending) {
    return (
      <>
        <DrawerTitle title="Loading task…" />
        <div className="flex flex-col gap-4 px-6" aria-busy>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </>
    );
  }
  if (query.isError && !query.data) {
    return (
      <>
        <DrawerTitle title="Task" />
        <ErrorState
          error={query.error}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </>
    );
  }

  const task = query.data;
  return (
    <>
      <SheetHeader className="flex-row items-center gap-2 border-b border-neutral-200 px-6 py-4 pr-14">
        <TaskKey value={task.key} className="text-sm" />
        <SheetTitle className="sr-only">
          {task.key} {task.name}
        </SheetTitle>
        <SheetDescription className="sr-only">
          Changes save as soon as you leave a field.
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
        <TaskEditForm task={task} onDirtyChange={onDirtyChange} />
        <TaskFacts task={task} />
        <TaskActivity id={task.id} />
      </div>
      <TaskDeleteFooter task={task} onDeleted={onClose} />
    </>
  );
}

function DrawerTitle({ title }: { title: string }) {
  return (
    <SheetHeader className="border-b border-neutral-200 px-6 py-4 pr-14">
      <SheetTitle>{title}</SheetTitle>
    </SheetHeader>
  );
}

type EditableField = 'name' | 'description' | 'priority' | 'status' | 'dueDate';

// One field at a time: another field being invalid mustn't block this one's save.
const editSchema = taskFormSchema.omit({ projectId: true }).partial();

function toFormValues(task: Task): TaskFormValues {
  return {
    projectId: task.projectId,
    name: task.name,
    description: task.description ?? '',
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate ?? '',
  };
}

/**
 * Inline edit: each field saves on blur (text, date) or change (selects) with only that field in
 * the PUT, optimistically (APP_FLOW F6). The form follows the cached task, so a rollback or a
 * refetch shows up in every field the user isn't editing.
 */
function TaskEditForm({
  task,
  onDirtyChange,
}: {
  task: Task;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { mutate } = useUpdateTask();
  const values = useMemo(() => toFormValues(task), [task]);
  const form = useForm({
    resolver: zodResolver(taskFormSchema),
    mode: 'onTouched',
    values,
    resetOptions: { keepDirtyValues: true },
  });
  const { register, control, trigger, getValues, resetField, formState } = form;

  useEffect(() => onDirtyChange(formState.isDirty), [formState.isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  async function save(field: EditableField) {
    if (!(await trigger(field))) return;
    const raw = getValues(field);
    const result = editSchema.safeParse({ [field]: raw });
    if (!result.success) return;
    // Clean again at once: the drawer can close right after a blur without "Discard changes?".
    resetField(field, { defaultValue: raw });
    if (isChange(task, result.data)) mutate({ task, patch: result.data });
  }

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={(event) => event.preventDefault()}
        className="flex flex-col gap-4"
        aria-label={`Edit ${task.key}`}
      >
        <FormField<TaskFormValues> name="name" label="Name">
          {(field) => (
            <Input
              maxLength={200}
              className="text-base font-semibold"
              {...register('name', { onBlur: () => void save('name') })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              {...field}
            />
          )}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField<TaskFormValues> name="status" label="Status">
            {(field) => (
              <Controller
                control={control}
                name="status"
                render={({ field: { value, onChange, onBlur, ref } }) => (
                  <TaskStatusSelect
                    value={value}
                    onChange={(status) => {
                      onChange(status);
                      void save('status');
                    }}
                    onBlur={onBlur}
                    ref={ref}
                    {...field}
                  />
                )}
              />
            )}
          </FormField>
          <FormField<TaskFormValues> name="priority" label="Priority">
            {(field) => (
              <Controller
                control={control}
                name="priority"
                render={({ field: { value, onChange, onBlur, ref } }) => (
                  <TaskPrioritySelect
                    value={value}
                    onChange={(priority) => {
                      onChange(priority);
                      void save('priority');
                    }}
                    onBlur={onBlur}
                    ref={ref}
                    {...field}
                  />
                )}
              />
            )}
          </FormField>
        </div>
        <FormField<TaskFormValues> name="dueDate" label="Due date">
          {(field) => (
            <Input
              type="date"
              className="sm:w-1/2"
              {...register('dueDate', { onBlur: () => void save('dueDate') })}
              {...field}
            />
          )}
        </FormField>
        <FormField<TaskFormValues> name="description" label="Description">
          {(field) => (
            <Textarea
              rows={5}
              maxLength={5000}
              placeholder="Add a description…"
              {...register('description', { onBlur: () => void save('description') })}
              {...field}
              className="max-h-72"
            />
          )}
        </FormField>
      </form>
    </FormProvider>
  );
}

/** Read-only: the project (TSK-03) and the dates the brief requires (DESIGN §4.3). */
function TaskFacts({ task }: { task: Task }) {
  const today = todayLocal();
  const localDate = (iso: string) => formatDate(todayLocal(new Date(iso)), today);

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
      <dt className="text-neutral-600">Project</dt>
      <dd className="min-w-0">
        <Link
          href={`/projects/${task.projectId}`}
          className="text-brand-700 hover:underline"
          title={task.project.name}
        >
          <span className="font-mono text-xs">{task.project.key}</span> · {task.project.name}
        </Link>
      </dd>
      <dt className="text-neutral-600">Created</dt>
      <dd>
        <time dateTime={task.createdAt}>{localDate(task.createdAt)}</time>
      </dd>
      {task.completedAt ? (
        <>
          <dt className="text-neutral-600">Completed</dt>
          <dd>
            <time dateTime={task.completedAt}>{localDate(task.completedAt)}</time>
          </dd>
        </>
      ) : null}
    </dl>
  );
}

function TaskDeleteFooter({ task, onDeleted }: { task: Task; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteTask();

  return (
    <div className="border-t border-neutral-200 px-6 py-4">
      <Button variant="ghost" className="text-danger-600" onClick={() => setConfirming(true)}>
        <Trash2Icon aria-hidden />
        Delete task
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        // DESIGN §5: Delete {key} "{name}"? This can't be undone. (TSK-05)
        title={`Delete ${task.key} "${task.name}"?`}
        description="This can't be undone."
        confirmLabel="Delete task"
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(task, {
            onSuccess: () => {
              toast.success(`${task.key} deleted`);
              setConfirming(false);
              onDeleted();
            },
            onError: (error) => toast.error(errorMessage(error)),
          })
        }
      />
    </div>
  );
}
