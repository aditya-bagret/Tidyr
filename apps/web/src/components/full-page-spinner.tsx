import { Loader2Icon } from 'lucide-react';

export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-dvh items-center justify-center">
      <Loader2Icon className="size-8 animate-spin text-brand-600" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}
