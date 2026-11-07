'use client';

import { cn } from '@conduit/ui/lib/utils';
import { IconMailPlus, IconUsers } from '@tabler/icons-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// A later settings section is one more entry here.
const SECTIONS: { href: Route; label: string; icon: typeof IconUsers }[] = [
  { href: '/settings/members', label: 'Members', icon: IconUsers },
  { href: '/settings/invitations', label: 'Invitations', icon: IconMailPlus },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Workspace settings" className="md:w-48 md:shrink-0">
      <ul className="flex gap-1 overflow-x-auto md:flex-col">
        {SECTIONS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap outline-none focus-visible:ring-[3px]',
                  isActive && 'bg-muted text-foreground font-medium'
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
