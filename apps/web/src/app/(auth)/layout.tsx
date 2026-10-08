'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { CenteredPage } from '@/components/centered-page';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { useAuth } from '@/features/auth/auth-provider';
import { BootError } from '@/features/auth/boot-error';
import { HOME_PATH } from '@/features/auth/routes';

/** Guest-only: a signed-in user is sent to the dashboard (APP_FLOW §3.1). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'authenticated') router.replace(HOME_PATH);
  }, [state, router]);

  if (state.status === 'error') return <BootError error={state.error} />;
  if (state.status !== 'unauthenticated') return <FullPageSpinner />;

  return <CenteredPage>{children}</CenteredPage>;
}
