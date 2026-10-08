'use client';

import { CenteredPage } from '@/components/centered-page';
import { ErrorState } from '@/components/error-state';
import { useAuth } from './auth-provider';

/** APP_FLOW §3.1: boot couldn't reach the API, so offer Retry instead of guessing at a redirect. */
export function BootError({ error }: { error: unknown }) {
  const { retryBoot } = useAuth();
  return (
    <CenteredPage>
      <ErrorState error={error} onRetry={retryBoot} />
    </CenteredPage>
  );
}
