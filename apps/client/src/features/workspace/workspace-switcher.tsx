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

import { useWorkspace } from './workspace-provider';

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
          <img
            src={activeWorkspace.logo}
            alt=""
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
                  void setActive(workspace.id);
                }}
              >
                {workspace.logo ? (
                  <img
                    src={workspace.logo}
                    alt=""
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
        <DropdownMenuItem>
          <IconPlus />
          Create workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
