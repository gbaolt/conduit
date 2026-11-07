'use client';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@conduit/ui/components/resizable';
import type { ReactNode } from 'react';

import { ChannelList } from '@/features/channels/components/channel-list';

import {
  type Layout,
  MAIN_PANEL,
  SIDEBAR_PANEL,
  writeLayoutCookie,
} from '../../lib/layout-cookie';
import { WorkspaceHeader } from './workspace-header';
import { WorkspaceNav } from './workspace-nav';

/** The channel list and the workspace entries above it. */
export function ChannelsNav() {
  return (
    <nav
      aria-label="Channels"
      className="text-surface-foreground flex flex-col overflow-x-hidden overflow-y-auto"
    >
      <WorkspaceHeader />
      <WorkspaceNav />
      <ChannelList />
    </nav>
  );
}

/**
 * The workspace shell: a resizable sidebar beside the page. Home puts the channels in the
 * sidebar and settings puts its menu there, so both share one width and one saved layout.
 */
export function WorkspaceSidebar({
  defaultLayout,
  sidebar,
  children,
}: {
  defaultLayout: Layout | undefined;
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <ResizablePanelGroup
      defaultLayout={defaultLayout}
      onLayoutChanged={(layout, { isUserInteraction }) => {
        if (isUserInteraction) writeLayoutCookie(layout);
      }}
    >
      <ResizablePanel
        id={SIDEBAR_PANEL}
        defaultSize="20"
        minSize="16"
        maxSize="24"
        className="bg-surface"
      >
        {sidebar}
      </ResizablePanel>
      <ResizableHandle className="bg-sidebar-border focus-visible:ring-sidebar-ring" />
      <ResizablePanel id={MAIN_PANEL}>
        <div className="h-full overflow-y-auto">{children}</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
