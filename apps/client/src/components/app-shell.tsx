import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
} from '@conduit/ui/components/sidebar';
import { Skeleton } from '@conduit/ui/components/skeleton';
import {
  IconBell,
  IconDots,
  IconFolder,
  IconHome,
  IconMessage,
} from '@tabler/icons-react';
import type { Route } from 'next';
import type { ReactNode } from 'react';

import { NavUser, type NavUserInfo } from '@/components/nav-user';
import { RailLink } from '@/components/rail-link';
import { SidePanelLayout } from '@/components/side-panel';
import { ThemeToggle } from '@/components/theme-toggle';
import { FeedUnreadBadge } from '@/features/feed/components/feed-unread-badge';
import { WorkspaceActivity } from '@/features/workspace/components/workspace-activity';
import { WorkspaceSwitcher } from '@/features/workspace/components/workspace-switcher';
import { WorkspaceProvider } from '@/features/workspace/context/workspace-provider';

const railItems: {
  href: Route;
  label: string;
  icon: typeof IconHome;
  badge?: ReactNode;
}[] = [
  { href: '/', label: 'Home', icon: IconHome },
  { href: '#', label: 'DMs', icon: IconMessage },
  {
    href: '/activity',
    label: 'Activity',
    icon: IconBell,
    badge: <FeedUnreadBadge />,
  },
  { href: '#', label: 'Files', icon: IconFolder },
  { href: '#', label: 'More', icon: IconDots },
];

export function AppShellSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading workspace"
      className="bg-sidebar flex h-svh"
    >
      <div aria-hidden className="flex h-svh w-16 shrink-0 flex-col">
        <div className="flex flex-col items-center p-2 pt-4 pb-2">
          <Skeleton className="size-9 rounded-lg" />
        </div>
        <div className="flex flex-1 flex-col items-center gap-2.5">
          {railItems.map(({ label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <Skeleton className="size-8.5 rounded-md" />
              <Skeleton className="h-3 text-[10px] text-transparent">
                {label}
              </Skeleton>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-3 p-2 pt-2 pb-4">
          <Skeleton className="size-8 rounded-[min(var(--radius-md),12px)]" />
          <Skeleton className="size-9 rounded-md" />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 py-2 pe-2">
        <div className="border-sidebar-border bg-background flex-1 rounded-xl border" />
      </div>
    </div>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: NavUserInfo;
  children: ReactNode;
}) {
  return (
    <WorkspaceProvider>
      <WorkspaceActivity />
      {/* A fixed height, not shadcn's min-h-svh, so a long log scrolls inside the page instead of growing it. */}
      <SidebarProvider
        className="bg-sidebar h-svh"
        style={
          {
            '--sidebar-width': 'calc(var(--spacing) * 16)',
          } as React.CSSProperties
        }
      >
        <Sidebar variant="inset" collapsible="none" className="h-svh">
          <SidebarHeader className="items-center pt-4 pb-2">
            <WorkspaceSwitcher />
          </SidebarHeader>
          <SidebarContent className="items-center gap-2">
            {railItems.map(({ icon: Icon, ...item }) => (
              <RailLink
                key={item.label}
                {...item}
                icon={<Icon className="size-4" />}
              />
            ))}
          </SidebarContent>
          <SidebarFooter className="mt-auto items-center gap-3 pt-2 pb-4">
            <ThemeToggle />
            <NavUser user={user} />
          </SidebarFooter>
        </Sidebar>
        <SidePanelLayout>{children}</SidePanelLayout>
      </SidebarProvider>
    </WorkspaceProvider>
  );
}
