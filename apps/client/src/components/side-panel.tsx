'use client';

import {
  ResizablePanel,
  ResizablePanelGroup,
} from '@conduit/ui/components/resizable';
import { SidebarInset } from '@conduit/ui/components/sidebar';
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { ResizeHandle } from '@/components/resize-handle';

type Dock = {
  owner: string | null;
  target: HTMLElement | null;
  claim: (id: string) => void;
  release: (id: string) => void;
};

const DockContext = createContext<Dock | null>(null);

/** The main card, and beside it a second card that a page fills through `SidePanel`. */
export function SidePanelLayout({ children }: { children: ReactNode }) {
  const [owner, setOwner] = useState<string | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const claim = useCallback((id: string) => setOwner(id), []);
  // A page that lost the dock to another page leaves it alone.
  const release = useCallback(
    (id: string) => setOwner((current) => (current === id ? null : current)),
    []
  );
  const dock = useMemo(
    () => ({ owner, target, claim, release }),
    [owner, target, claim, release]
  );

  return (
    <DockContext value={dock}>
      <ResizablePanelGroup className="min-h-0 min-w-0 flex-1 overflow-hidden py-2 pe-2">
        <ResizablePanel
          id="main"
          minSize="60%"
          groupResizeBehavior="preserve-pixel-size"
        >
          <SidebarInset className="border-sidebar-border h-full min-h-0 overflow-hidden rounded-xl border">
            {children}
          </SidebarInset>
        </ResizablePanel>
        {owner && (
          <>
            <ResizeHandle className="w-2 bg-transparent" />
            <ResizablePanel
              id="side"
              defaultSize={512}
              minSize={448}
              groupResizeBehavior="preserve-pixel-size"
            >
              <aside
                ref={setTarget}
                className="border-sidebar-border bg-background h-full overflow-hidden rounded-xl border"
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </DockContext>
  );
}

/** Shows its children in the side card while it is mounted. The newest mount wins. */
export function SidePanel({ children }: { children: ReactNode }) {
  const dock = use(DockContext);
  if (!dock) throw new Error('SidePanel must be used within SidePanelLayout.');
  const { owner, target, claim, release } = dock;
  const id = useId();

  // A layout effect, so the card opens in the same paint as the click. A route hidden by Activity releases it.
  useLayoutEffect(() => {
    claim(id);
    return () => release(id);
  }, [claim, release, id]);

  return owner === id && target ? createPortal(children, target) : null;
}
