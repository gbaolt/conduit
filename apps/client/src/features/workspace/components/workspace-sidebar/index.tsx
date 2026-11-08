'use client';

import {
  ResizablePanel,
  ResizablePanelGroup,
} from '@conduit/ui/components/resizable';
import type { ReactNode } from 'react';

import { useAtList } from '@/components/list-view';
import { ResizeHandle } from '@/components/resize-handle';

import {
  type Layout,
  MAIN_PANEL,
  SIDEBAR_PANEL,
  writeLayoutCookie,
} from '../../lib/layout-cookie';

/** The sidebar's scrolling column. Put the workspace header, its nav, and the room groups inside. */
export function WorkspaceSidebarNav({
  'aria-label': label,
  children,
}: {
  'aria-label': string;
  children: ReactNode;
}) {
  return (
    <nav
      aria-label={label}
      className="text-surface-foreground flex flex-col overflow-x-hidden overflow-y-auto"
    >
      {children}
    </nav>
  );
}

/**
 * The workspace shell: a resizable sidebar beside the page. Home puts the rooms in the
 * sidebar and settings puts its menu there, so both share one width and one saved layout.
 * A phone shows one of the two: the sidebar on its list route, the page everywhere else.
 *
 * Compose it as `WorkspaceSidebar > WorkspaceSidebarPanel + WorkspaceSidebarMain`.
 */
export function WorkspaceSidebar({
  defaultLayout,
  children,
}: {
  defaultLayout: Layout | undefined;
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
      {children}
    </ResizablePanelGroup>
  );
}

/** The sidebar column and the handle that resizes it. */
export function WorkspaceSidebarPanel({ children }: { children: ReactNode }) {
  return (
    <>
      <ResizablePanel
        id={SIDEBAR_PANEL}
        defaultSize={300}
        minSize={240}
        maxSize={360}
        groupResizeBehavior="preserve-pixel-size"
        className="bg-surface"
      >
        {children}
      </ResizablePanel>
      <ResizeHandle className="bg-sidebar-border" />
    </>
  );
}

/** The page beside the sidebar. */
export function WorkspaceSidebarMain({ children }: { children: ReactNode }) {
  return (
    <ResizablePanel
      id={MAIN_PANEL}
      minSize={500}
      groupResizeBehavior="preserve-pixel-size"
    >
      <div className="h-full overflow-y-auto">{children}</div>
    </ResizablePanel>
  );
}
