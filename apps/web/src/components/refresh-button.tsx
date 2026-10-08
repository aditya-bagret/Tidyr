'use client';

import { cn } from 'cn';
import { RefreshCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface RefreshButtonProps {
  onRefresh: () => void;
  refreshing: boolean;
  className?: string;
}

/** The manual refetch in list headers (APP_FLOW §7), for changes made on the other platform. */
export function RefreshButton({ onRefresh, refreshing, className }: RefreshButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh"
          onClick={onRefresh}
          className={cn('text-neutral-600', className)}
        >
          <RefreshCwIcon className={cn(refreshing && 'animate-spin')} aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Refresh</TooltipContent>
    </Tooltip>
  );
}
