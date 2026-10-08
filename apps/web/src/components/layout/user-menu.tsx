'use client';

import { LogOutIcon } from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth, useCurrentUser } from '@/features/auth/auth-provider';
import { initials } from '@/lib/names';

/** Avatar initials → name, email, Log out (DESIGN §3 AppShell). No confirmation on web (APP_FLOW §3.3). */
export function UserMenu() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const [pending, setPending] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex size-11 items-center justify-center rounded-full lg:size-10"
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-brand-50 text-xs font-semibold text-brand-700">
            {initials(user.fullName)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="truncate text-sm font-semibold text-neutral-900">{user.fullName}</span>
          <span className="truncate text-xs text-neutral-600">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onSelect={() => {
            setPending(true);
            void logout();
          }}
        >
          <LogOutIcon aria-hidden />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
