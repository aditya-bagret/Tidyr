'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/features/auth/auth-provider';
import { BootError } from '@/features/auth/boot-error';
import { loginPath } from '@/features/auth/routes';

/** Client-side guard (TECHNICAL_REQUIREMENTS §9): spinner while booting, Login without a session. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'unauthenticated') router.replace(loginPath(state.reason));
  }, [state, router]);

  if (state.status === 'authenticated') return <AppShell>{children}</AppShell>;
  if (state.status === 'error') return <BootError error={state.error} />;
  return <FullPageSpinner />;
}
