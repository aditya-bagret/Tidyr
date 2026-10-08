'use client';

import { useEffect, useEffectEvent } from 'react';

/** Single-key shortcuts, keyed by `KeyboardEvent.key` (lower case for letters). */
export type Shortcuts = Partial<Record<string, () => void>>;

/** Typing in a field, or something layered on top (drawer, dialog, menu), owns the keyboard. */
function shouldIgnore(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.repeat) return true;
  if (event.metaKey || event.ctrlKey || event.altKey) return true;
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select, [role="combobox"]'))
  ) {
    return true;
  }
  return document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]') !== null;
}

/**
 * APP_FLOW §7: `/` focuses search, `c` creates a task (project page and `/tasks`). They're off
 * while typing or while a drawer, dialog or menu is open; `Esc` closing those is Radix's own.
 */
export function useShortcuts(shortcuts: Shortcuts) {
  const handle = useEffectEvent((event: KeyboardEvent) => {
    if (shouldIgnore(event)) return;
    const action = shortcuts[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (!action) return;
    event.preventDefault();
    action();
  });

  useEffect(() => {
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []);
}
