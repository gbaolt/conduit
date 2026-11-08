'use client';

import { useIsMobile } from '@conduit/ui/hooks/use-mobile';
import { useQueryState } from 'nuqs';
import { type ReactNode, useCallback, useMemo } from 'react';

import { SidePanel } from '@/components/side-panel';

import { SummaryProvider } from '../context/summary';
import { OpenThread } from '../context/thread';
import { ThreadPanel } from './thread-panel';

/** Puts the thread named by `?thread=` in the side card beside the main card, or over the conversation on a phone. */
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
    <SummaryProvider target={{ kind: 'channel', channelId }}>
      <OpenThread value={open}>
        <div className="relative h-full min-h-0">
          {children}
          {panel && isMobile && (
            <div className="bg-background absolute inset-0 z-20">{panel}</div>
          )}
          {panel && !isMobile && <SidePanel>{panel}</SidePanel>}
        </div>
      </OpenThread>
    </SummaryProvider>
  );
}
