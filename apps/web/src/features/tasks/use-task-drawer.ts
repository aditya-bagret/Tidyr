'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

// The element that opened the drawer (a row or card button). The drawer opens from the URL, so
// Radix has no trigger to give focus back to on close (DESIGN §6). One drawer per page, so one slot.
let opener: HTMLElement | null = null;

/** The opener, if it's still on the page; cleared once read. */
export function takeOpener(): HTMLElement | null {
  const element = opener;
  opener = null;
  return element?.isConnected ? element : null;
}

function rememberOpener() {
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

/**
 * The task drawer lives in the URL (APP_FLOW §1): `?task=<id>` views and edits a task,
 * `?newTask=1` creates one. Opening pushes a history entry, so Back closes the drawer.
 */
export function useTaskDrawer() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const taskId = searchParams.get('task');
  const creating = searchParams.get('newTask') === '1';

  const navigate = useCallback(
    (patch: { task?: string | null; newTask?: boolean }, mode: 'push' | 'replace') => {
      const query = new URLSearchParams(searchParams.toString());
      query.delete('task');
      query.delete('newTask');
      if (patch.task) query.set('task', patch.task);
      if (patch.newTask) query.set('newTask', '1');
      const url = query.size > 0 ? `${pathname}?${query.toString()}` : pathname;
      router[mode](url, { scroll: false });
    },
    [searchParams, pathname, router],
  );

  const openTask = useCallback(
    (id: string) => {
      rememberOpener();
      navigate({ task: id }, 'push');
    },
    [navigate],
  );
  const openCreate = useCallback(() => {
    rememberOpener();
    navigate({ newTask: true }, 'push');
  }, [navigate]);
  /** After a create, the drawer stays open on the new task (APP_FLOW F5). */
  const showCreated = useCallback((id: string) => navigate({ task: id }, 'replace'), [navigate]);
  const close = useCallback(() => navigate({}, 'replace'), [navigate]);

  return { taskId, creating, openTask, openCreate, showCreated, close };
}
