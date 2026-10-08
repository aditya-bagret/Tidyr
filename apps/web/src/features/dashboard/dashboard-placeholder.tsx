'use client';

import { LayoutDashboardIcon } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { useCurrentUser } from '@/features/auth/auth-provider';
import { firstName } from '@/lib/names';

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Phase 8 placeholder; Phase 9 replaces it with the real dashboard (APP_FLOW F9). */
export function DashboardPlaceholder() {
  const user = useCurrentUser();

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold text-neutral-900">
        {greeting(new Date().getHours())}, {firstName(user.fullName)}
      </h2>
      <div className="rounded-lg border border-neutral-200 bg-neutral-0 shadow-card">
        <EmptyState
          icon={LayoutDashboardIcon}
          title="Your dashboard is on its way"
          description="Project and task stats, overdue and upcoming tasks will show up here."
        />
      </div>
    </div>
  );
}
