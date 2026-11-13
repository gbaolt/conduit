'use client';

import { Button } from '@conduit/ui/components/button';
import { cn } from '@conduit/ui/lib/utils';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Home owns every route that no other rail link claims. */
function isRailActive(href: Route, pathname: string) {
  if (href === '/') return !pathname.startsWith('/activity');
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function RailLink({
  href,
  label,
  icon,
  badge,
}: {
  href: Route;
  label: string;
  icon: ReactNode;
  /** Placed over the icon's top corner. It follows the label in the DOM, so its text reads "Activity, 3 unread". */
  badge?: ReactNode;
}) {
  const isActive = isRailActive(href, usePathname());

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative flex flex-col items-center justify-center gap-1 text-[10px]',
        isActive ? 'text-sidebar-accent-foreground' : 'text-muted-foreground'
      )}
    >
      <Button
        data-slot="sidebar-menu-button"
        size="icon"
        variant="ghost"
        className={cn(
          'hover:bg-sidebar-accent!',
          isActive && 'bg-sidebar-accent'
        )}
      >
        {icon}
      </Button>
      {label}
      {badge}
    </Link>
  );
}
