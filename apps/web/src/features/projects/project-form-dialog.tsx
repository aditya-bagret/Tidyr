'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  isApiError,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  projectFormSchema,
  suggestProjectKey,
  type Project,
  type ProjectFormOutput,
  type ProjectFormValues,
} from '@tidyr/shared';
import { useRouter } from 'next/navigation';
import { useState, type RefObject } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { focusInstead } from '@/components/confirm-dialog';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { applyFieldErrors, errorMessage } from '@/lib/errors';
import { useCreateProject, useUpdateProject } from './queries';

const FIELDS = ['name', 'key', 'description', 'status', 'startDate', 'endDate'] as const;

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit mode when set; otherwise the dialog creates a project. */
  project?: Project;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/** Create/edit project dialog (APP_FLOW F3, F4; D-019). Full screen below 640 px. */
export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  returnFocusRef,
}: ProjectFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(event) => focusInstead(event, returnFocusRef)}
        className="max-h-dvh overflow-y-auto max-sm:inset-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:content-start max-sm:rounded-none sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{project ? 'Edit project' : 'New project'}</DialogTitle>
          <DialogDescription>
            {project ? `Update ${project.key}'s details.` : 'Only the name is required.'}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every open starts from fresh values. */}
        <ProjectForm project={project} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function defaultValues(project?: Project): ProjectFormValues {
  return {
    name: project?.name ?? '',
    key: project?.key ?? '',
    description: project?.description ?? '',
    status: project?.status ?? 'NOT_STARTED',
    startDate: project?.startDate ?? '',
    endDate: project?.endDate ?? '',
  };
}

function ProjectForm({ project, onDone }: { project?: Project; onDone: () => void }) {
  const router = useRouter();
  const create = useCreateProject();
  const update = useUpdateProject(project?.id ?? '');
  // While the user hasn't typed a key, it follows the name (PRJ-09). Editing never auto-changes it.
  const [keyEdited, setKeyEdited] = useState(Boolean(project));
  const form = useForm({
    resolver: zodResolver(projectFormSchema),
    mode: 'onTouched',
    defaultValues: defaultValues(project),
  });
  const { register, handleSubmit, setError, setValue, control, formState } = form;

  async function onSubmit(values: ProjectFormOutput) {
    try {
      if (project) {
        if (values.key === undefined) {
          setError('key', { type: 'required', message: 'Required' }, { shouldFocus: true });
          return;
        }
        await update.mutateAsync(values);
        toast.success('Project updated');
        onDone();
      } else {
        // An untouched suggestion is left to the API, which adds a number if it's taken (WR2).
        const created = await create.mutateAsync(
          keyEdited ? values : { ...values, key: undefined },
        );
        toast.success('Project created');
        onDone();
        router.push(`/projects/${created.id}`);
      }
    } catch (error) {
      if (isApiError(error) && error.code === 'CONFLICT') {
        setError('key', { type: 'server', message: 'Key already used' }, { shouldFocus: true });
        return;
      }
      if (applyFieldErrors(error, setError, FIELDS)) return;
      toast.error(errorMessage(error));
    }
  }

  return (
    <FormProvider {...form}>
      <form
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormField<ProjectFormValues> name="name" label="Name">
          {(field) => (
            <Input
              maxLength={120}
              {...register('name', {
                onChange: (event: { target: { value: string } }) => {
                  if (keyEdited) return;
                  const name = event.target.value.trim();
                  setValue('key', name ? suggestProjectKey(name) : '');
                },
              })}
              {...field}
            />
          )}
        </FormField>
        <FormField<ProjectFormValues>
          name="key"
          label="Key"
          hint="The prefix of its task keys, like WEB-12. 2–10 letters or digits."
        >
          {(field) => (
            <Input
              maxLength={10}
              autoCapitalize="characters"
              spellCheck={false}
              className="font-mono uppercase"
              {...register('key', {
                // Clearing the key hands it back to the name.
                onChange: (event: { target: { value: string } }) =>
                  setKeyEdited(Boolean(project) || event.target.value.trim() !== ''),
              })}
              {...field}
            />
          )}
        </FormField>
        <FormField<ProjectFormValues> name="description" label="Description">
          {(field) => (
            <Textarea
              rows={3}
              maxLength={5000}
              {...register('description')}
              {...field}
              className="max-h-48"
            />
          )}
        </FormField>
        <FormField<ProjectFormValues> name="status" label="Status">
          {(field) => (
            <Controller
              control={control}
              name="status"
              render={({ field: { value, onChange, onBlur, ref } }) => (
                <Select value={value} onValueChange={onChange}>
                  <SelectTrigger ref={ref} onBlur={onBlur} className="w-full" {...field}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {PROJECT_STATUS_LABEL[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField<ProjectFormValues> name="startDate" label="Start date">
            {(field) => (
              // The range error sits on End date, so changing the start re-checks it.
              <Input type="date" {...register('startDate', { deps: ['endDate'] })} {...field} />
            )}
          </FormField>
          <FormField<ProjectFormValues> name="endDate" label="End date">
            {(field) => <Input type="date" {...register('endDate')} {...field} />}
          </FormField>
        </div>
        <DialogFooter className="mt-2">
          <DialogClose asChild>
            <Button variant="secondary" disabled={formState.isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="submit"
            loading={formState.isSubmitting}
            disabled={Boolean(project) && !formState.isDirty}
          >
            {project ? 'Save changes' : 'Create project'}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
