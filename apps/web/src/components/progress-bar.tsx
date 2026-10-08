import { cn } from 'cn';

interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  className?: string;
}

/** 6 px track, success fill (DESIGN §3). An empty max reads as 0%, not NaN. */
export function ProgressBar({ value, max, label, className }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-neutral-100', className)}
    >
      <div className="h-full rounded-full bg-success-600" style={{ width: `${percent}%` }} />
    </div>
  );
}
