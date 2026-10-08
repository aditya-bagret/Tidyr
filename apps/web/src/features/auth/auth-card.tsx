import type { ReactNode } from 'react';

/** DESIGN §4.6: a centered card, max 400 px, full width with 16 px gutters on phones. */
export function AuthCard({
  title,
  footer,
  children,
}: {
  title: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="w-full max-w-100">
      <section className="rounded-lg border border-neutral-200 bg-neutral-0 p-6 shadow-card sm:p-8">
        <h1 className="mb-6 text-2xl font-semibold text-neutral-900">{title}</h1>
        {children}
      </section>
      <p className="mt-6 text-center text-sm text-neutral-600">{footer}</p>
    </div>
  );
}
