'use client';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@conduit/ui/components/resizable';
import { useIsMobile } from '@conduit/ui/hooks/use-mobile';
import { useQueryState } from 'nuqs';
import { type ReactNode, useCallback, useMemo } from 'react';

import { OpenThread } from '../context/thread';
import { ThreadPanel } from './thread-panel';

/** Puts the thread named by `?thread=` beside the conversation, or over it on a phone. */
export function ThreadLayout({
  channelId,
  children,
}: {
  channelId: string;
  /** The conversation: its header and its log. */
  children: ReactNode;
}) {
  const [threadId, setThreadId] = useQueryState('thread');
  const isMobile = useIsMobile();

  const close = useCallback(() => {
    const closing = threadId;
    void setThreadId(null).then(() =>
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(`[data-thread-line="${closing}"]`)
          ?.focus()
      )
    );
  }, [threadId, setThreadId]);

  const open = useMemo(
    () => (rootId: string) => void setThreadId(rootId),
    [setThreadId]
  );

  const panel = threadId && (
    <ThreadPanel
      key={threadId}
      channelId={channelId}
      threadId={threadId}
      onClose={close}
    />
  );

  return (
    <OpenThread value={open}>
      {isMobile ? (
        <div className="relative h-full min-h-0">
          {children}
          {panel && (
            <div className="bg-background absolute inset-0 z-20">{panel}</div>
          )}
        </div>
      ) : (
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel id="conversation" minSize="30%">
            {children}
          </ResizablePanel>
          {panel && (
            <>
              <ResizableHandle />
              <ResizablePanel
                id="thread"
                defaultSize="380px"
                minSize="320px"
                maxSize="60%"
              >
                {panel}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      )}
    </OpenThread>
  );
}
