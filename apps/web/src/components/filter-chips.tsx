'use client';

import { cn } from 'cn';
import { CheckIcon } from 'lucide-react';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface FilterChipsProps<T extends string> {
  label: string;
  options: readonly ChipOption<T>[];
  selected: readonly T[];
  onChange: (selected: T[]) => void;
  className?: string;
}

/** The pill (DESIGN §3); selected uses `brand.50` with `brand.700` text and a check icon. */
export function chipClassName(selected: boolean): string {
  return cn(
    // The ::after extends the hit area to 44 px without making the pill look bigger.
    'relative inline-flex h-8 items-center gap-1 rounded-full border px-3 text-sm font-medium transition-colors after:absolute after:inset-x-0 after:-inset-y-1.5',
    selected
      ? 'border-brand-600/30 bg-brand-50 text-brand-700'
      : 'border-neutral-200 bg-neutral-0 text-neutral-600 hover:bg-neutral-100',
  );
}

/** Multi-select pills (DESIGN §3). Selection keeps the options' order so URLs stay stable. */
export function FilterChips<T extends string>({
  label,
  options,
  selected,
  onChange,
  className,
}: FilterChipsProps<T>) {
  function toggle(value: T) {
    const next = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    onChange(options.map((option) => option.value).filter((item) => next.includes(item)));
  }

  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => toggle(option.value)}
            className={chipClassName(isSelected)}
          >
            {isSelected ? <CheckIcon className="size-3.5" aria-hidden /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
