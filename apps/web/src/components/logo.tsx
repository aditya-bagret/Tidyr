import { cn } from 'cn';

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span
      className={cn('inline-flex items-center gap-2 font-semibold text-neutral-900', className)}
    >
      <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden>
        <rect
          x="4"
          y="4"
          width="16"
          height="16"
          rx="3"
          transform="rotate(45 12 12)"
          className="fill-brand-600"
        />
        <path
          d="M8.5 12.2l2.3 2.3 4.7-4.7"
          className="fill-none stroke-neutral-0"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={cn('text-lg', compact && 'sr-only')}>Tidyr</span>
    </span>
  );
}
