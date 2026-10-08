import { cn } from 'cn';
import { AlertCircleIcon, AlertTriangleIcon, InfoIcon, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type Tone = 'error' | 'warning' | 'info';

const TONES: Record<Tone, { icon: LucideIcon; className: string }> = {
  // danger.600 text on danger.50 is 4.4:1, under AA, so only the icon carries the colour.
  error: {
    icon: AlertCircleIcon,
    className: 'border-danger-600/20 bg-danger-50 text-neutral-900 [&>svg]:text-danger-600',
  },
  warning: {
    icon: AlertTriangleIcon,
    className: 'border-warning-600/20 bg-warning-50 text-neutral-900 [&>svg]:text-warning-600',
  },
  info: {
    icon: InfoIcon,
    className: 'border-info-600/20 bg-info-50 text-neutral-900 [&>svg]:text-info-600',
  },
};

/** An inline message above a form: errors, the rate-limit wait, the session banner. */
export function Banner({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  const { icon: Icon, className: toneClass } = TONES[tone];
  return (
    <div
      role={tone === 'info' ? 'status' : 'alert'}
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm',
        toneClass,
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
