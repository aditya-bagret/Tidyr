'use client';

import { cn } from 'cn';
import { SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useEffectEvent, useState, type Ref } from 'react';

export const SEARCH_DEBOUNCE_MS = 300;

interface SearchInputProps {
  /** The committed value, usually from the URL. */
  value: string;
  /** Called 300 ms after typing stops, and at once when cleared. */
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  /** Shows the `/` hint (the shortcut itself is wired by the page). */
  shortcutHint?: boolean;
  /** For the `/` shortcut, which focuses the input. */
  ref?: Ref<HTMLInputElement>;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  label,
  placeholder = 'Search',
  shortcutHint = false,
  ref,
  className,
}: SearchInputProps) {
  const [text, setText] = useState(value);
  const [committed, setCommitted] = useState(value);
  const [prevValue, setPrevValue] = useState(value);

  // An outside change (e.g. "Clear filters") replaces the text; our own debounced commit coming
  // back through the URL doesn't, so typing in the meantime isn't overwritten.
  if (value !== prevValue) {
    setPrevValue(value);
    if (value !== committed) {
      setText(value);
      setCommitted(value);
    }
  }

  const commit = useEffectEvent((next: string) => {
    setCommitted(next);
    onChange(next);
  });

  useEffect(() => {
    if (text === committed) return;
    const timer = setTimeout(() => commit(text), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, committed]);

  function clear() {
    setText('');
    setCommitted('');
    onChange('');
  }

  return (
    <div className={cn('relative w-full', className)}>
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400"
        aria-hidden
      />
      <input
        ref={ref}
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && text !== '') {
            event.stopPropagation();
            clear();
          }
        }}
        aria-label={label}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-input bg-card pr-10 pl-9 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {text !== '' ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-sm text-neutral-600 hover:bg-neutral-100"
        >
          <XIcon className="size-4" aria-hidden />
        </button>
      ) : shortcutHint ? (
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded-sm border border-neutral-200 px-1.5 font-mono text-xs text-neutral-600 sm:block">
          /
        </kbd>
      ) : null}
    </div>
  );
}
