import {
  FolderKanbanIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
  { href: '/projects', label: 'Projects', icon: FolderKanbanIcon },
  { href: '/tasks', label: 'My Tasks', icon: ListChecksIcon },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function pageTitle(pathname: string): string {
  return NAV_ITEMS.find((item) => isActive(pathname, item.href))?.label ?? 'Tidyr';
}
