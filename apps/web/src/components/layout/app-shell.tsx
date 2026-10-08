'use client';

import { cn } from 'cn';
import { MenuIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { pageTitle } from './nav-items';
import { SidebarNav } from './sidebar-nav';
import { UserMenu } from './user-menu';

/**
 * APP_FLOW §7: ≥ 1024 px a fixed sidebar; 768–1023 px an icon rail that can expand over the
 * content; < 768 px a top bar whose menu button opens the nav in a sheet.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [railExpanded, setRailExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="min-h-dvh">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col gap-6 border-r border-neutral-200 bg-neutral-0 px-3 py-4 md:flex lg:w-60',
          railExpanded ? 'w-60 shadow-overlay lg:shadow-none' : 'w-16',
        )}
      >
        <div
          className={cn(
            'flex h-8 items-center px-2',
            !railExpanded && 'justify-center px-0 lg:justify-start lg:px-2',
          )}
        >
          <Logo compact={!railExpanded} className="lg:hidden" />
          <Logo className="hidden lg:inline-flex" />
        </div>
        <div className="lg:hidden">
          <SidebarNav collapsed={!railExpanded} onNavigate={() => setRailExpanded(false)} />
        </div>
        <div className="hidden lg:block">
          <SidebarNav />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="mt-auto self-center lg:hidden"
          aria-label={railExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={railExpanded}
          onClick={() => setRailExpanded((expanded) => !expanded)}
        >
          {railExpanded ? <PanelLeftCloseIcon aria-hidden /> : <PanelLeftOpenIcon aria-hidden />}
        </Button>
      </aside>

      <div className="md:pl-16 lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-neutral-200 bg-neutral-0 px-2 sm:px-4">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 md:hidden"
                aria-label="Open navigation"
              >
                <MenuIcon className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 gap-6 px-3 py-4" aria-describedby={undefined}>
              <SheetTitle className="px-2">
                <Logo />
              </SheetTitle>
              <SidebarNav onNavigate={() => setSheetOpen(false)} />
            </SheetContent>
          </Sheet>
          <h1 className="truncate text-lg font-semibold text-neutral-900">{pageTitle(pathname)}</h1>
          <div className="ml-auto">
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-content px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
