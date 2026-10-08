'use client';

import { useCallback, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { TaskCreateForm } from './task-create-form';
import { TaskDetails } from './task-details';
import { takeOpener, useTaskDrawer } from './use-task-drawer';

interface TaskDrawerProps {
  /** The project page's id: new tasks go there, so the form has no project select. */
  projectId?: string;
}

/**
 * DESIGN §3 TaskDrawer: a 480 px right sheet, full screen below 768 px. `?task=<id>` shows and
 * edits a task, `?newTask=1` creates one. Closing a form with unsaved input asks first (§7).
 */
export function TaskDrawer({ projectId }: TaskDrawerProps) {
  const { taskId, creating, close, showCreated } = useTaskDrawer();
  const [dirty, setDirty] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const open = taskId !== null || creating;

  const requestClose = useCallback(() => {
    if (dirty) setConfirmingDiscard(true);
    else close();
  }, [dirty, close]);

  return (
    <Sheet open={open} onOpenChange={(next) => !next && requestClose()}>
      <SheetContent
        side="right"
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:md:w-[480px]"
        onCloseAutoFocus={(event) => {
          // Opened from the URL, there's no trigger for Radix to return to: use the row or card.
          const opener = takeOpener();
          if (!opener) return;
          event.preventDefault();
          opener.focus();
        }}
      >
        {creating ? (
          <TaskCreateForm
            projectId={projectId}
            onCreated={(task) => showCreated(task.id)}
            onCancel={requestClose}
            onDirtyChange={setDirty}
          />
        ) : taskId ? (
          <TaskDetails key={taskId} id={taskId} onDirtyChange={setDirty} onClose={close} />
        ) : null}
      </SheetContent>
      <ConfirmDialog
        open={confirmingDiscard}
        onOpenChange={setConfirmingDiscard}
        title="Discard changes?"
        description="What you've entered hasn't been saved."
        confirmLabel="Discard"
        onConfirm={() => {
          setConfirmingDiscard(false);
          setDirty(false);
          close();
        }}
      />
    </Sheet>
  );
}
