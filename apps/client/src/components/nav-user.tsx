'use client';

import type { SessionOutput } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import {
  IconBell,
  IconBellPause,
  IconLogout,
  IconMoodSmile,
  IconMoonFilled,
  IconRocket,
  IconSettings,
  IconUser,
} from '@tabler/icons-react';
import Link from 'next/link';

import { UserAvatar } from '@/components/user-avatar';
import { useWorkspace } from '@/features/workspace/context/workspace-provider';
import { useSignOut } from '@/services/auth/hooks';
import {
  useDnd,
  useUpdateNotificationSettings,
} from '@/services/notifications/hooks';

export type NavUserInfo = Pick<
  NonNullable<SessionOutput>['user'],
  'name' | 'email' | 'image'
>;

const MINUTE_MS = 60_000;

const PAUSES = [
  { label: '30 minutes', until: () => new Date(Date.now() + 30 * MINUTE_MS) },
  { label: '1 hour', until: () => new Date(Date.now() + 60 * MINUTE_MS) },
  { label: '2 hours', until: () => new Date(Date.now() + 120 * MINUTE_MS) },
  {
    label: 'Until tomorrow',
    until: () => {
      const morning = new Date();
      morning.setDate(morning.getDate() + 1);
      morning.setHours(8, 0, 0, 0);
      return morning;
    },
  },
];

export function NavUser({ user }: { user: NavUserInfo }) {
  const { activeWorkspace } = useWorkspace();
  const signOut = useSignOut();
  const dnd = useDnd();
  const { mutate: updateSettings } = useUpdateNotificationSettings();
  const upgradeLabel = activeWorkspace
    ? `Upgrade ${activeWorkspace.name}`
    : 'Upgrade';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              dnd.active ? 'Account menu, notifications paused' : 'Account menu'
            }
            className="relative"
          />
        }
      >
        <UserAvatar
          name={user.name}
          image={user.image}
          className="size-9 rounded-md"
        />
        {dnd.active && (
          <span className="bg-sidebar absolute -right-0.5 -bottom-0.5 rounded-full p-0.5">
            <IconMoonFilled aria-hidden className="size-3" />
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="end"
        sideOffset={8}
        className="min-w-64"
      >
        <DropdownMenuGroup>
          <div className="flex items-center gap-2 px-1.5 py-1.5">
            <UserAvatar name={user.name} image={user.image} />
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm font-medium">
                {user.name}
              </p>
              <p className="flex items-center gap-1.5 text-xs">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">Active</span>
              </p>
            </div>
          </div>
          <div className="px-1 py-1">
            <div className="border-border text-muted-foreground flex h-8 items-center gap-1.5 rounded-md border px-2 text-sm">
              <IconMoodSmile className="size-4" />
              Update your status
            </div>
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/settings/notifications" />}>
            <IconBell />
            Notifications
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <IconBellPause />
              Pause notifications
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              {PAUSES.map(({ label, until }) => (
                <DropdownMenuItem
                  key={label}
                  onClick={() => updateSettings({ dndUntil: until() })}
                >
                  {label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!dnd.snoozed}
                onClick={() => updateSettings({ dndUntil: null })}
              >
                Resume
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {dnd.label && (
            <p className="text-muted-foreground px-1.5 pb-1 text-xs">
              {dnd.label}
            </p>
          )}
          <DropdownMenuItem>
            <IconUser />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem>
            <IconSettings />
            Preferences
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <IconRocket />
            {upgradeLabel}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={signOut.isPending}
            onClick={() => signOut.mutate()}
          >
            <IconLogout />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
