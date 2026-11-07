'use client';

import { Button } from '@conduit/ui/components/button';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@conduit/ui/components/sidebar';
import {
  IconAdjustmentsHorizontal,
  IconArrowLeft,
  IconKey,
  IconLock,
  IconMailPlus,
  IconUsers,
} from '@tabler/icons-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useWorkspace } from '@/features/workspace/context/workspace-provider';

type Area = { href: Route; label: string; icon: typeof IconUsers };

const GROUPS: { label: string; areas: Area[] }[] = [
  {
    label: 'Workspace',
    areas: [
      {
        href: '/settings/general',
        label: 'General',
        icon: IconAdjustmentsHorizontal,
      },
      { href: '/settings/permissions', label: 'Permissions', icon: IconLock },
    ],
  },
  {
    label: 'People',
    areas: [
      { href: '/settings/members', label: 'Members', icon: IconUsers },
      {
        href: '/settings/invitations',
        label: 'Invitations',
        icon: IconMailPlus,
      },
      { href: '/settings/access', label: 'Access', icon: IconKey },
    ],
  },
];

/** The settings menu. It sits where the channel list does, so opening settings swaps the sidebar, not the page. */
export function SettingsNav() {
  const pathname = usePathname();
  const { activeWorkspace } = useWorkspace();

  return (
    <nav
      aria-label="Workspace settings"
      className="text-surface-foreground flex flex-col overflow-x-hidden overflow-y-auto"
    >
      <Button
        variant="ghost"
        size="sm"
        aria-label="Back to workspace"
        nativeButton={false}
        render={<Link href="/" />}
        className="m-1 ml-2 w-fit"
      >
        <IconArrowLeft data-icon="inline-start" />
        <span className="truncate text-base font-semibold">
          {activeWorkspace?.name ?? 'Workspace'}
        </span>
      </Button>
      <SidebarSeparator className="mx-0" />

      {GROUPS.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.areas.map(({ href, label, icon: Icon }) => {
                const isActive = pathname.startsWith(href);

                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={
                        <Link
                          href={href}
                          aria-current={isActive ? 'page' : undefined}
                        />
                      }
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </nav>
  );
}
