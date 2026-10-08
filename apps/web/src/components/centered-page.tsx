import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';

/** The logo above centred content: the auth screens, the 404 page and full-page errors. */
export function CenteredPage({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <Logo />
      {children}
    </main>
  );
}
