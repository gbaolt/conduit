'use client';

import { Button } from '@conduit/ui/components/button';
import { cn } from '@conduit/ui/lib/utils';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const OTHER_RAIL_ROOTS = ['/activity', '/dms', '/files', '/canvases'];

const isUnder = (href: string, pathname: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/** Home owns every route that no other rail link claims. */
function isRailActive(href: Route, pathname: string) {
  if (href === '/') {
    return !OTHER_RAIL_ROOTS.some((root) => isUnder(root, pathname));
  }
  return isUnder(href, pathname);
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

const BADGE_MAX = 99;

/** A count over a rail icon's top corner, capped at "99+". Pass it as `RailLink`'s `badge`. It renders nothing at zero. */
export function RailLinkBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <>
      <span className="sr-only">, {count} unread</span>
      <span
        aria-hidden
        className="bg-primary text-primary-foreground absolute top-0 left-1/2 ml-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-medium tabular-nums"
      >
        {count > BADGE_MAX ? `${BADGE_MAX}+` : count}
      </span>
    </>
  );
}
