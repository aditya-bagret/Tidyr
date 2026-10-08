'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  isApiError,
  taskFormSchema,
  type Task,
  type TaskFormOutput,
  type TaskFormValues,
} from '@tidyr/shared';
import Link from 'next/link';
import { useEffect } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { applyFieldErrors, errorMessage } from '@/lib/errors';
import { useProjects } from '@/features/projects/queries';
import { useCreateTask } from './queries';
import { TaskPrioritySelect, TaskStatusSelect } from './task-selects';

const FIELDS = ['projectId', 'name', 'description', 'priority', 'status', 'dueDate'] as const;

// The API's page maximum; the select lists projects by name.
const PROJECT_OPTIONS = { sort: 'name', order: 'asc', limit: 100 } as const;

interface TaskCreateFormProps {
  /** Preselected on a project page; My Tasks asks for it (APP_FLOW F5). */
  projectId?: string;
  onCreated: (task: Task) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

/** `?newTask=1`: Name*, Description, Priority (Medium), Status (Pending), Due date (TSK-01). */
export function TaskCreateForm({
  projectId,
  onCreated,
  onCancel,
  onDirtyChange,
}: TaskCreateFormProps) {
  const create = useCreateTask();
  const form = useForm({
    resolver: zodResolver(taskFormSchema),
    mode: 'onTouched',
    defaultValues: {
      projectId: projectId ?? '',
      name: '',
      description: '',
      priority: 'MEDIUM',
      status: 'PENDING',
      dueDate: '',
    } satisfies TaskFormValues,
  });
  const { register, handleSubmit, control, setError, formState } = form;

  useEffect(() => onDirtyChange(formState.isDirty), [formState.isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  async function onSubmit(values: TaskFormOutput) {
    try {
      const task = await create.mutateAsync(values);
      toast.success(`${task.key} created`);
      onDirtyChange(false);
      onCreated(task);
    } catch (error) {
      // The project was deleted (or never ours) since the form opened.
      if (isApiError(error) && error.code === 'NOT_FOUND') {
        setError(
          'projectId',
          { type: 'server', message: "This project doesn't exist or you don't have access to it." },
          { shouldFocus: true },
        );
        return;
      }
      if (applyFieldErrors(error, setError, FIELDS)) return;
      toast.error(errorMessage(error));
    }
  }

  return (
    <>
      <SheetHeader className="border-b border-neutral-200 px-6 py-4 pr-14">
        <SheetTitle className="text-base font-semibold">Create task</SheetTitle>
        <SheetDescription>Only the name is required.</SheetDescription>
      </SheetHeader>
      <FormProvider {...form}>
        <form
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            {projectId ? null : <ProjectField />}
            <FormField<TaskFormValues> name="name" label="Name">
              {(field) => <Input maxLength={200} autoFocus {...register('name')} {...field} />}
            </FormField>
            <FormField<TaskFormValues> name="description" label="Description">
              {(field) => (
                <Textarea
                  rows={4}
                  maxLength={5000}
                  {...register('description')}
                  {...field}
                  className="max-h-60"
                />
              )}
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField<TaskFormValues> name="priority" label="Priority">
                {(field) => (
                  <Controller
                    control={control}
                    name="priority"
                    render={({ field: { value, onChange, onBlur, ref } }) => (
                      <TaskPrioritySelect
                        value={value}
                        onChange={onChange}
                        onBlur={onBlur}
                        ref={ref}
                        {...field}
                      />
                    )}
                  />
                )}
              </FormField>
              <FormField<TaskFormValues> name="status" label="Status">
                {(field) => (
                  <Controller
                    control={control}
                    name="status"
                    render={({ field: { value, onChange, onBlur, ref } }) => (
                      <TaskStatusSelect
                        value={value}
                        onChange={onChange}
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
                <Input type="date" className="sm:w-1/2" {...register('dueDate')} {...field} />
              )}
            </FormField>
          </div>
          <div className="flex justify-end gap-2 border-t border-neutral-200 px-6 py-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              Create task
            </Button>
          </div>
        </form>
      </FormProvider>
    </>
  );
}

/** My Tasks only: which project the task goes in (required). */
function ProjectField() {
  const projects = useProjects(PROJECT_OPTIONS);
  const options = projects.data?.data ?? [];

  return (
    <FormField<TaskFormValues>
      name="projectId"
      label="Project"
      hint={
        projects.isError
          ? `Couldn't load your projects. ${errorMessage(projects.error)}`
          : undefined
      }
    >
      {(field) => (
        <>
          <Controller<TaskFormValues, 'projectId'>
            name="projectId"
            render={({ field: { value, onChange, onBlur, ref } }) => (
              <Select value={value} onValueChange={onChange} disabled={projects.isPending}>
                <SelectTrigger ref={ref} onBlur={onBlur} className="w-full" {...field}>
                  <SelectValue
                    placeholder={projects.isPending ? 'Loading projects…' : 'Choose a project'}
                  />
                </SelectTrigger>
                <SelectContent position="popper">
                  {options.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <span className="font-mono text-xs text-neutral-600">{project.key}</span>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {projects.isSuccess && options.length === 0 ? (
            <p className="text-xs text-neutral-600">
              You don&apos;t have any projects yet.{' '}
              <Link href="/projects" className="text-brand-700 underline">
                Create a project
              </Link>{' '}
              first.
            </p>
          ) : null}
        </>
      )}
    </FormField>
  );
}
