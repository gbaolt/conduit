'use client';

import { useQueryState } from 'nuqs';
import { type ReactNode, useCallback, useMemo } from 'react';

import { SidePanel } from '@/components/side-panel';
import { useMediaQuery } from '@/hooks/use-media-query';

import { SummaryProvider } from '../context/summary';
import { OpenThread } from '../context/thread';
import { ThreadPanel } from './thread-panel';

/**
 * Puts the thread named by `?thread=` in the side card beside the main card from xl up. Narrower, the thread
 * replaces the conversation, and its back button returns to it.
 */
export function ThreadLayout({
  channelId,
  children,
}: {
  channelId: string;
  /** The conversation: its header and its log. */
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
      channelId={channelId}
      threadId={threadId}
      onClose={close}
    />
  );

  return (
    <SummaryProvider target={{ kind: 'channel', channelId }}>
      <OpenThread value={open}>
        <div className="relative h-full min-h-0">
          {children}
          {panel && !docked && (
            <div className="bg-background absolute inset-0 z-20">{panel}</div>
          )}
          {panel && docked && <SidePanel>{panel}</SidePanel>}
        </div>
      </OpenThread>
    </SummaryProvider>
  );
}
