'use client';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@conduit/ui/components/sidebar';
import {
  IconAddressBook,
  IconListSearch,
  IconMessages,
  IconSend,
} from '@tabler/icons-react';

const LINKS = [
  { label: 'Threads', icon: IconMessages },
  { label: 'Drafts & sent', icon: IconSend },
  { label: 'Directories', icon: IconAddressBook },
];

/** The workspace-wide entries above the channel list. */
export function WorkspaceNav() {
  return (
    <>
      <SidebarGroup className="gap-2">
        <div className="relative">
          <IconListSearch className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
          <SidebarInput
            type="search"
            placeholder="Find a conversation..."
            aria-label="Find a conversation"
            className="pl-8"
          />
        </div>
        <SidebarGroupContent>
          <SidebarMenu>
            {LINKS.map(({ label, icon: Icon }) => (
              <SidebarMenuItem key={label}>
                <SidebarMenuButton>
                  <Icon />
                  <span>{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarSeparator className="mx-0" />
    </>
  );
}
