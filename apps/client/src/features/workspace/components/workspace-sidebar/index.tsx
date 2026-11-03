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

/** The workspace shell. A resizable sidebar beside the page. */
export function WorkspaceSidebar({
  defaultLayout,
  children,
}: {
  defaultLayout: Layout | undefined;
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
        defaultSize={260}
        minSize={200}
        maxSize="40"
        className="bg-surface"
      >
        <nav
          aria-label="Channels"
          className="text-surface-foreground flex flex-col overflow-x-hidden overflow-y-auto"
        >
          <WorkspaceHeader />
          <WorkspaceNav />
          <ChannelList />
        </nav>
      </ResizablePanel>
      <ResizableHandle className="bg-sidebar-border focus-visible:ring-sidebar-ring" />
      <ResizablePanel id={MAIN_PANEL}>
        <div className="h-full overflow-y-auto">{children}</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
