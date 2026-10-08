'use client';

import { ErrorState } from '@/components/error-state';

interface ErrorPageProps {
  error: Error & { digest?: string };
  retry: () => void;
}

/** A render error in a page keeps the sidebar and top bar usable, with Retry for the page. */
export default function AppError({ error, retry }: ErrorPageProps) {
  return (
    <ErrorState
      error={error}
      onRetry={retry}
      className="rounded-md border border-neutral-200 bg-neutral-0 shadow-card"
    />
  );
}
