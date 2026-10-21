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
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { useWorkspace } from '@/features/workspace/workspace-provider';
import { authClient } from '@/services/auth/client';

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
      <img
        src={image}
        alt=""
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const [pending, setPending] = useState(false);
  const upgradeLabel = activeWorkspace
    ? `Upgrade ${activeWorkspace.name}`
    : 'Upgrade';

  const handleSignOut = async () => {
    setPending(true);

    const { error } = await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          queryClient.clear();
          router.push('/sign-in');
          router.refresh();
        },
      },
    });

    if (error) {
      setPending(false);
      toast.error(error.message ?? 'Sign-out failed. Please try again.');
    }
  };

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
            disabled={pending}
            onClick={() => void handleSignOut()}
          >
            <IconLogout />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
