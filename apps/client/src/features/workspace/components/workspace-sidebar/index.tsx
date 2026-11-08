'use client';

import {
  ResizablePanel,
  ResizablePanelGroup,
} from '@conduit/ui/components/resizable';
import type { ReactNode } from 'react';

import { useAtList } from '@/components/list-view';
import { ResizeHandle } from '@/components/resize-handle';
import { ChannelList } from '@/features/channels/components/channel-list';
import { ChannelListSkeleton } from '@/features/channels/components/channel-skeletons';

import {
  type Layout,
  MAIN_PANEL,
  SIDEBAR_PANEL,
  writeLayoutCookie,
} from '../../lib/layout-cookie';
import { WorkspaceHeader } from './workspace-header';
import { WorkspaceNav } from './workspace-nav';

/** The channel list and the workspace entries above it. `loading` stands in a skeleton for the list. */
export function ChannelsNav({ loading = false }: { loading?: boolean }) {
  return (
    <nav
      aria-label="Channels"
      className="text-surface-foreground flex flex-col overflow-x-hidden overflow-y-auto"
    >
      <WorkspaceHeader />
      <WorkspaceNav />
      {loading ? <ChannelListSkeleton /> : <ChannelList />}
    </nav>
  );
}

/**
 * The workspace shell: a resizable sidebar beside the page. Home puts the channels in the
 * sidebar and settings puts its menu there, so both share one width and one saved layout.
 * A phone shows one of the two: the sidebar on its list route, the page everywhere else.
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
  const atList = useAtList();

  return (
    <ResizablePanelGroup
      data-view={atList ? 'list' : 'page'}
      className={atList ? 'max-md:*:last:hidden!' : 'max-md:*:not-last:hidden!'}
      defaultLayout={defaultLayout}
      onLayoutChanged={(layout, { isUserInteraction }) => {
        if (isUserInteraction) writeLayoutCookie(layout);
      }}
    >
      <ResizablePanel
        id={SIDEBAR_PANEL}
        defaultSize={300}
        minSize={240}
        maxSize={360}
        groupResizeBehavior="preserve-pixel-size"
        className="bg-surface"
      >
        {sidebar}
      </ResizablePanel>
      <ResizeHandle className="bg-sidebar-border" />
      <ResizablePanel
        id={MAIN_PANEL}
        minSize={500}
        groupResizeBehavior="preserve-pixel-size"
      >
        <div className="h-full overflow-y-auto">{children}</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
