'use client';

import { useIsFetching } from '@tanstack/react-query';

/**
 * APP_FLOW §5 "Refetching": a thin bar while a query that already has data refetches (window
 * focus, Refresh, the next page). First loads show skeletons instead, so they're excluded.
 */
export function RefetchBar() {
  const refetching = useIsFetching({ predicate: (query) => query.state.data !== undefined });
  if (refetching === 0) return null;
  return (
    <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-brand-50" aria-hidden>
      <div className="h-full w-1/3 animate-[refetch_1.2s_ease-in-out_infinite] bg-brand-600" />
    </div>
  );
}
