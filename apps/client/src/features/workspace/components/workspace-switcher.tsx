'use client';

import { Button } from '@conduit/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import { IconCheck, IconPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useSwitchWorkspace } from '@/services/workspaces/hooks';

import { useWorkspace } from '../context/workspace-provider';
import { WorkspaceIcon } from './workspace-icon';

export function WorkspaceSwitcher() {
  const router = useRouter();
  const { workspaces, activeWorkspace, isPending } = useWorkspace();
  const { mutate: switchWorkspace } = useSwitchWorkspace();
  const label = activeWorkspace?.name ?? 'Workspaces';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className="hover:bg-sidebar-accent size-9 rounded-lg p-0"
            aria-label={label}
          />
        }
      >
        <WorkspaceIcon
          logo={activeWorkspace?.logo}
          size={36}
          className="size-9"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-56 min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {isPending && (
            <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
          )}
          {!isPending && workspaces.length === 0 && (
            <DropdownMenuItem disabled>No workspaces yet</DropdownMenuItem>
          )}
          {!isPending &&
            workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => {
                  // The open channel belongs to the old workspace, so land on the new one's default channel.
                  switchWorkspace(workspace.id, {
                    onSuccess: () => router.push('/'),
                  });
                }}
              >
                <WorkspaceIcon
                  logo={workspace.logo}
                  size={16}
                  className="size-4 rounded-sm"
                />
                <span className="min-w-0 flex-1 truncate">
                  {workspace.name}
                </span>
                {workspace.id === activeWorkspace?.id ? <IconCheck /> : null}
              </DropdownMenuItem>
            ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={<Link href="/onboarding?step=create" target="_blank" />}
        >
          <IconPlus />
          Create workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
