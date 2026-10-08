'use client';

import type { Project } from '@tidyr/shared';
import type { RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { errorMessage } from '@/lib/errors';
import { useDeleteProject } from './queries';

interface ProjectDeleteDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/** DESIGN §5: 'Delete "{name}"? This also deletes {n} tasks. This can't be undone.' (PRJ-05). */
export function deleteProjectMessage(taskCount: number): string {
  const tasks = taskCount === 1 ? '1 task' : `${taskCount} tasks`;
  return taskCount > 0
    ? `This also deletes ${tasks}. This can't be undone.`
    : "It has no tasks. This can't be undone.";
}

export function ProjectDeleteDialog({
  project,
  open,
  onOpenChange,
  returnFocusRef,
}: ProjectDeleteDialogProps) {
  const router = useRouter();
  const remove = useDeleteProject(project.id);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete "${project.name}"?`}
      description={deleteProjectMessage(project.taskCounts.total)}
      confirmLabel="Delete project"
      pending={remove.isPending}
      returnFocusRef={returnFocusRef}
      onConfirm={() =>
        remove.mutate(undefined, {
          onSuccess: () => {
            toast.success(`Deleted "${project.name}"`);
            router.replace('/projects');
          },
          onError: (error) => toast.error(errorMessage(error)),
        })
      }
    />
  );
}
