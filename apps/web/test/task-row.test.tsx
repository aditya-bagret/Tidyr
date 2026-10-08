import type { Task } from '@tidyr/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TaskRow } from '@/features/tasks/task-row';

const TODAY = '2026-10-08';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    key: 'WEB-7',
    number: 7,
    projectId: 'project-1',
    project: { id: 'project-1', key: 'WEB', name: 'Website Redesign' },
    name: 'Design hero section',
    description: null,
    priority: 'HIGH',
    status: 'PENDING',
    dueDate: '2026-10-20',
    completedAt: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

function setup(task: Task) {
  const onUpdate = vi.fn();
  const onOpen = vi.fn();
  render(
    <ul>
      <TaskRow task={task} today={TODAY} onOpen={onOpen} onUpdate={onUpdate} />
    </ul>,
  );
  return { user: userEvent.setup(), onUpdate, onOpen };
}

describe('TaskRow complete toggle (T-WEB-03)', () => {
  it('completes an open task in one click', async () => {
    const task = makeTask({ status: 'IN_PROGRESS' });
    const { user, onUpdate } = setup(task);

    const checkbox = screen.getByRole('checkbox', { name: 'Mark WEB-7 complete' });
    expect(checkbox.getAttribute('aria-checked')).toBe('false');
    await user.click(checkbox);

    expect(onUpdate).toHaveBeenCalledExactlyOnceWith(task, { status: 'COMPLETED' });
  });

  it('reopens a completed task as Pending', async () => {
    const task = makeTask({ status: 'COMPLETED', completedAt: '2026-10-05T09:00:00.000Z' });
    const { user, onUpdate } = setup(task);

    const checkbox = screen.getByRole('checkbox', { name: 'Reopen WEB-7' });
    expect(checkbox.getAttribute('aria-checked')).toBe('true');
    await user.click(checkbox);

    expect(onUpdate).toHaveBeenCalledExactlyOnceWith(task, { status: 'PENDING' });
  });

  it('opens the task from its name without toggling it', async () => {
    const { user, onUpdate, onOpen } = setup(makeTask());

    await user.click(screen.getByRole('button', { name: 'Design hero section' }));

    expect(onOpen).toHaveBeenCalledExactlyOnceWith('task-1');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('labels status and priority in text, not colour alone (DESIGN §6)', () => {
    setup(makeTask({ status: 'IN_PROGRESS', priority: 'LOW' }));

    expect(screen.getByRole('button', { name: 'Status: In Progress. Change status' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Priority: Low. Change priority' })).toBeTruthy();
  });
});
