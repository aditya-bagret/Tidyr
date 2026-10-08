import { ArrowLeftIcon, FileQuestionIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CenteredPage } from '@/components/centered-page';
import { Button } from '@/components/ui/button';
import { HOME_PATH } from '@/features/auth/routes';

export const metadata: Metadata = { title: 'Page not found' };

/** APP_FLOW §1 `not-found`. A signed-out visitor following the link is sent on to Login. */
export default function NotFound() {
  return (
    <CenteredPage>
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-0 px-6 py-10 text-center shadow-card">
        <span className="flex size-12 items-center justify-center rounded-full bg-neutral-100">
          <FileQuestionIcon className="size-6 text-neutral-600" aria-hidden />
        </span>
        <h1 className="text-lg font-semibold text-neutral-900">Page not found</h1>
        <p className="text-sm text-neutral-600">This page doesn&apos;t exist or has moved.</p>
        <Button variant="secondary" asChild className="mt-1">
          <Link href={HOME_PATH}>
            <ArrowLeftIcon aria-hidden />
            Back to dashboard
          </Link>
        </Button>
      </div>
    </CenteredPage>
  );
}
