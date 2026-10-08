'use client';

import { cn } from 'cn';
import { AlertTriangleIcon, RotateCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/errors';

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

/** APP_FLOW §5: the failure's message plus Retry. */
export function ErrorState({ error, onRetry, retrying = false, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-3 px-4 py-12 text-center', className)}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-50">
        <AlertTriangleIcon className="size-6 text-danger-600" aria-hidden />
      </span>
      <p className="max-w-sm text-sm text-neutral-900">{errorMessage(error)}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry} loading={retrying}>
          <RotateCwIcon aria-hidden />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
