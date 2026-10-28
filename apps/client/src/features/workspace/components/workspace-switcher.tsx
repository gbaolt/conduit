'use client';

import { BrandIcon } from '@conduit/ui/components/brand';
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
import Image from 'next/image';
import Link from 'next/link';

import { useWorkspace } from '../context/workspace-provider';

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, isPending, setActive } = useWorkspace();
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
        {activeWorkspace?.logo ? (
          <Image
            src={activeWorkspace.logo}
            alt=""
            width={36}
            height={36}
            className="size-9 rounded-lg object-cover"
          />
        ) : (
          <BrandIcon className="size-9" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-56 min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {isPending ? (
            <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
          ) : workspaces.length === 0 ? (
            <DropdownMenuItem disabled>No workspaces yet</DropdownMenuItem>
          ) : (
            workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => {
                  setActive(workspace.id);
                }}
              >
                {workspace.logo ? (
                  <Image
                    src={workspace.logo}
                    alt=""
                    width={16}
                    height={16}
                    className="size-4 rounded-sm object-cover"
                  />
                ) : (
                  <BrandIcon className="size-4" />
                )}
                <span className="min-w-0 flex-1 truncate">
                  {workspace.name}
                </span>
                {workspace.id === activeWorkspace?.id ? <IconCheck /> : null}
              </DropdownMenuItem>
            ))
          )}
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
