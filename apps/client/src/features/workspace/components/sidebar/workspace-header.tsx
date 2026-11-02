'use client';

import { Button } from '@conduit/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@conduit/ui/components/tooltip';
import { IconChevronDown, IconEdit, IconSettings } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';

import { useChannelDialogs } from '@/features/channels/context/channel-dialogs-provider';
import { useWorkspace } from '@/features/workspace/context/workspace-provider';

const FILTERS = [
  {
    value: 'active',
    label: 'Active only',
    hint: 'New activity within the last 30 days',
  },
  { value: 'unreads', label: 'Unreads' },
  { value: 'mentions', label: 'Mentions' },
  { value: 'all', label: 'All' },
  { value: 'sections', label: 'Custom by section' },
];

const SORTS = [
  { value: 'az', label: 'A–Z' },
  { value: 'recency', label: 'Recency' },
  { value: 'priority', label: 'Priority' },
];

function WorkspaceMenu() {
  const { activeWorkspace } = useWorkspace();
  const name = activeWorkspace?.name ?? 'Workspace';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="sm" variant="ghost" className="text-lg font-bold" />
        }
      >
        <span className="truncate">{name}</span>
        <IconChevronDown data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuItem>Invite people to {name}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Preferences</DropdownMenuItem>
        <DropdownMenuItem>Workflow builder</DropdownMenuItem>
        <DropdownMenuItem>Admin tools</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/onboarding" />}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarSettingsMenu() {
  const { open } = useChannelDialogs();
  // shortcut: the choices are kept locally and do not filter or sort yet; wire them up with the list behaviour.
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('az');
  const filterLabel = FILTERS.find((f) => f.value === filter)?.label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Sidebar settings"
          />
        }
      >
        <IconSettings />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Filter and sort
            <span className="text-muted-foreground ml-auto text-xs">
              {filterLabel}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Filter conversations by</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={filter} onValueChange={setFilter}>
                {FILTERS.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                  >
                    <span className="flex flex-col">
                      {option.label}
                      {option.hint ? (
                        <span className="text-muted-foreground text-xs">
                          {option.hint}
                        </span>
                      ) : null}
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Sort conversations by</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
                {SORTS.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => open({ kind: 'section-name' })}>
          Create a section
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function WorkspaceHeader() {
  return (
    <div className="flex h-12 shrink-0 items-center gap-1 px-2">
      <WorkspaceMenu />
      <div className="ml-auto flex shrink-0 items-center">
        <SidebarSettingsMenu />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="New message" />
            }
          >
            <IconEdit />
          </TooltipTrigger>
          <TooltipContent>New message</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
