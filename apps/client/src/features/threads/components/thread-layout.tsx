'use client';

import { useQueryState } from 'nuqs';
import { type ReactNode, useCallback, useMemo } from 'react';

import { SidePanel } from '@/components/side-panel';
import { SummaryProvider } from '@/features/messages/context/summary';
import { OpenThread } from '@/features/messages/context/thread';
import { useMediaQuery } from '@/hooks/use-media-query';

import { ThreadPanel } from './thread-panel';

/**
 * Puts the thread named by `?thread=` in the side card beside the main card from xl up. Narrower, the thread
 * replaces the main card's content, and its back button returns to it.
 */
export function ThreadLayout({
  roomId,
  children,
}: {
  /** The conversation the page shows. Without one, as on the Threads page, a thread opens in its own room. */
  roomId?: string;
  children: ReactNode;
}) {
  const [threadId, setThreadId] = useQueryState('thread');
  const docked = useMediaQuery('(min-width: 80rem)');

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
      roomId={roomId}
      threadId={threadId}
      onClose={close}
    />
  );

  const layout = (
    <OpenThread value={open}>
      <div className="relative h-full min-h-0">
        {children}
        {panel && !docked && (
          <div className="bg-background absolute inset-0 z-20">{panel}</div>
        )}
        {panel && docked && <SidePanel>{panel}</SidePanel>}
      </div>
    </OpenThread>
  );

  return roomId ? (
    <SummaryProvider target={{ kind: 'channel', roomId }}>
      {layout}
    </SummaryProvider>
  ) : (
    layout
  );
}
