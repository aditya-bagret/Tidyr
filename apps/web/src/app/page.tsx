'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { useAuth } from '@/features/auth/auth-provider';
import { BootError } from '@/features/auth/boot-error';
import { HOME_PATH, loginPath } from '@/features/auth/routes';

export default function IndexPage() {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'authenticated') router.replace(HOME_PATH);
    if (state.status === 'unauthenticated') router.replace(loginPath(state.reason));
  }, [state, router]);

  if (state.status === 'error') return <BootError error={state.error} />;
  return <FullPageSpinner />;
}
