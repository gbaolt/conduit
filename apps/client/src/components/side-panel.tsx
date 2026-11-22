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
  /** The panel the card shows: the newest one still mounted. */
  owner: string | null;
  target: HTMLElement | null;
  claim: (id: string) => void;
  release: (id: string) => void;
};

const DockContext = createContext<Dock | null>(null);

/**
 * The main card, and beside it a second card that a page fills through `SidePanel`. Panels stack, so closing the
 * newest shows the one it covered.
 */
export function SidePanelLayout({ children }: { children: ReactNode }) {
  const [owners, setOwners] = useState<readonly string[]>([]);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const claim = useCallback(
    (id: string) =>
      setOwners((current) => [...current.filter((each) => each !== id), id]),
    []
  );
  const release = useCallback(
    (id: string) =>
      setOwners((current) => current.filter((each) => each !== id)),
    []
  );
  const owner = owners.at(-1) ?? null;
  const dock = useMemo(
    () => ({ owner, target, claim, release }),
    [owner, target, claim, release]
  );

  return (
    <DockContext value={dock}>
      <ResizablePanelGroup className="min-h-0 min-w-0 flex-1 overflow-hidden pe-2 pb-2">
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

/** Shows its children in the side card while it is mounted and no newer `SidePanel` covers it. */
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
