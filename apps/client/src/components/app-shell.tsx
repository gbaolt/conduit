import { Button } from '@repo/ui/components/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from '@repo/ui/components/sidebar';
import { cn } from '@repo/ui/lib/utils';
import {
  IconBell,
  IconDots,
  IconFolder,
  IconHome,
  IconMessage,
} from '@tabler/icons-react';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { NavUser, type NavUserInfo } from '@/components/nav-user';
import { ThemeToggle } from '@/components/theme-toggle';
import { WorkspaceProvider } from '@/features/workspace/workspace-provider';
import { WorkspaceSwitcher } from '@/features/workspace/workspace-switcher';

function RailLink({
  href,
  label,
  icon: Icon,
  isActive,
}: {
  href: Route;
  label: string;
  icon: typeof IconHome;
  isActive?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex flex-col items-center justify-center gap-1 text-[10px]',
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
        <Icon className="size-4" />
      </Button>
      {label}
    </Link>
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
      <SidebarProvider
        className="bg-sidebar"
        style={
          {
            '--sidebar-width': 'calc(var(--spacing) * 16)',
          } as React.CSSProperties
        }
      >
        <Sidebar variant="inset" collapsible="none" className="h-svh">
          <SidebarHeader className="items-center pt-5 pb-2">
            <WorkspaceSwitcher />
          </SidebarHeader>
          <SidebarContent className="items-center gap-2">
            <RailLink href="/" label="Home" icon={IconHome} isActive />
            <RailLink href="#" label="DMs" icon={IconMessage} />
            <RailLink href="#" label="Activity" icon={IconBell} />
            <RailLink href="#" label="Files" icon={IconFolder} />
            <RailLink href="#" label="More" icon={IconDots} />
          </SidebarContent>
          <SidebarFooter className="mt-auto items-center gap-3 pt-2 pb-5">
            <ThemeToggle />
            <NavUser user={user} />
          </SidebarFooter>
        </Sidebar>
        <div className="flex min-h-0 min-w-0 flex-1 py-2 pe-1.5">
          <SidebarInset className="border-sidebar-border min-h-0 overflow-hidden rounded-xl border">
            {children}
          </SidebarInset>
        </div>
      </SidebarProvider>
    </WorkspaceProvider>
  );
}
