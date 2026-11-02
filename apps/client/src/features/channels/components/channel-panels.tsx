'use client';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@conduit/ui/components/resizable';
import type { ReactNode } from 'react';

import {
  CHANNELS_PANEL,
  type Layout,
  MAIN_PANEL,
  writeLayoutCookie,
} from '../lib/layout-cookie';
import { ChannelSidebar } from './channel-sidebar';

export function ChannelPanels({
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
      style={{ height: '100%' }}
    >
      <ResizablePanel
        id={CHANNELS_PANEL}
        defaultSize={260}
        minSize={200}
        maxSize="40"
        className="bg-surface"
      >
        <ChannelSidebar />
      </ResizablePanel>
      <ResizableHandle className="bg-sidebar-border focus-visible:ring-sidebar-ring" />
      <ResizablePanel id={MAIN_PANEL}>
        <div className="h-full overflow-y-auto">{children}</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
