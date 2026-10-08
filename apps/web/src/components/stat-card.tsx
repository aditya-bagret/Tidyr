import { cn } from 'cn';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  /** The filtered list this number comes from (APP_FLOW F9). */
  href: string;
  tone?: 'default' | 'danger';
  className?: string;
}

/** Icon, label and a big number; the whole card deep-links to the list behind it (DESIGN §3). */
export function StatCard({
  icon: Icon,
  label,
  value,
  href,
  tone = 'default',
  className,
}: StatCardProps) {
  const danger = tone === 'danger';
  return (
    <Link
      href={href}
      className={cn(
        'flex min-w-0 flex-col justify-between gap-3 rounded-md border bg-neutral-0 p-4 shadow-card transition-colors hover:border-brand-600/40 hover:bg-neutral-50',
        danger ? 'border-danger-600/30' : 'border-neutral-200',
        className,
      )}
    >
      <span
        className={cn(
          'flex items-start gap-2 text-sm font-medium',
          danger ? 'text-danger-600' : 'text-neutral-600',
        )}
      >
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        {label}
      </span>
      <span className="text-3xl font-bold text-neutral-900 tabular-nums">{value}</span>
    </Link>
  );
}

export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-md border border-neutral-200 bg-neutral-0 p-4 shadow-card',
        className,
      )}
    >
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-12" />
    </div>
  );
}
