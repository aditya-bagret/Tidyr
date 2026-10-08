'use client';

import { CenteredPage } from '@/components/centered-page';
import { ErrorState } from '@/components/error-state';

interface ErrorPageProps {
  error: Error & { digest?: string };
  retry: () => void;
}

/**
 * A render error outside the app shell (auth screens, the shell itself). ErrorState shows the
 * generic message, never the error's own text, so no internals reach the screen.
 */
export default function RootError({ error, retry }: ErrorPageProps) {
  return (
    <CenteredPage>
      <ErrorState error={error} onRetry={retry} />
    </CenteredPage>
  );
}
