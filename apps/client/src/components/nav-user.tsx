'use client';

import { Button } from '@conduit/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import { cn } from '@conduit/ui/lib/utils';
import {
  IconBell,
  IconLogout,
  IconMoodSmile,
  IconRocket,
  IconSettings,
  IconUser,
} from '@tabler/icons-react';
import Image from 'next/image';

import { useWorkspace } from '@/features/workspace/context/workspace-provider';
import { useSignOut } from '@/services/auth/hooks';

export type NavUserInfo = {
  name: string;
  email: string;
  image?: string | null;
};

function UserAvatar({
  name,
  image,
  className,
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  if (image) {
    return (
      // 36px covers the largest render (size-9 in the sidebar).
      <Image
        src={image}
        alt=""
        width={36}
        height={36}
        className={cn('size-8 rounded-full object-cover', className)}
      />
    );
  }

  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <span
      className={cn(
        'bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-full text-xs font-medium',
        className
      )}
    >
      {initial}
    </span>
  );
}

export function NavUser({ user }: { user: NavUserInfo }) {
  const { activeWorkspace } = useWorkspace();
  const signOut = useSignOut();
  const upgradeLabel = activeWorkspace
    ? `Upgrade ${activeWorkspace.name}`
    : 'Upgrade';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Account menu" />
        }
      >
        <UserAvatar
          name={user.name}
          image={user.image}
          className="size-9 rounded-md"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="end"
        sideOffset={8}
        className="w-72 min-w-72"
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
          <DropdownMenuItem>
            <IconBell />
            Notifications
          </DropdownMenuItem>
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
