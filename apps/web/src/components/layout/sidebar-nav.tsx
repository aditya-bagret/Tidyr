'use client';

import { cn } from 'cn';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { isActive, NAV_ITEMS } from './nav-items';

interface SidebarNavProps {
  /** Icon-only rail (768–1023 px when collapsed): labels become tooltips. */
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        const link = (
          <Link
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            aria-label={collapsed ? label : undefined}
            className={cn(
              'flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors lg:h-10',
              collapsed && 'justify-center px-0',
              active
                ? 'bg-brand-50 text-brand-700'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            {collapsed ? null : label}
          </Link>
        );

        if (!collapsed) return <div key={href}>{link}</div>;
        return (
          <Tooltip key={href}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}
