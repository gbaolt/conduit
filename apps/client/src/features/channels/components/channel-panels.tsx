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
    // The height cap is the shell's min-h-svh minus its py-2, so each panel scrolls on its own. The library's inline height beats a class.
    <ResizablePanelGroup
      defaultLayout={defaultLayout}
      onLayoutChanged={(layout, { isUserInteraction }) => {
        // Mount and constraint recomputes would freeze the default width as a percentage.
        if (isUserInteraction) writeLayoutCookie(layout);
      }}
      style={{ height: 'calc(100svh - 1rem)' }}
    >
      <ResizablePanel
        id={CHANNELS_PANEL}
        defaultSize={260}
        minSize={200}
        maxSize="40"
        className="bg-sidebar"
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
