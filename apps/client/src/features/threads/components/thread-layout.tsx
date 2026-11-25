'use client';

import type { ReactNode } from 'react';

import { SidePanel } from '@/components/side-panel';
import { ConversationSplit } from '@/features/messages/components/conversation/conversation-split';
import { SummaryProvider } from '@/features/messages/context/summary';
import { OpenThread } from '@/features/messages/context/thread';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useSplit } from '@/hooks/use-split';

import { ThreadPanel } from './thread-panel';

/**
 * Puts the thread named by `?thread=`, or the room named by `?room=`, in the side card beside the main card
 * from xl up. Narrower, it replaces the main card's content, and its back button returns to it.
 */
export function ThreadLayout({
  roomId,
  threadMenu,
  children,
}: {
  /** The conversation the page shows. Without one, as on the Threads page, a thread opens in its own room. */
  roomId?: string;
  /** More items for the open thread's header menu. The route passes them, so this feature imports no other. */
  threadMenu?: ReactNode;
  children: ReactNode;
}) {
  const [{ thread: threadId, room }, setSplit] = useSplit();
  const docked = useMediaQuery('(min-width: 80rem)');
  // The page's own room beside itself would be the same log twice.
  const splitRoomId = room && room !== roomId ? room : null;

  const closeThread = () => {
    const closing = threadId;
    void setSplit({ thread: null }).then(() =>
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(`[data-thread-line="${closing}"]`)
          ?.focus()
      )
    );
  };

  // A thread and a room share the one side card. The page's thread takes it; the split room's thread keeps
  // `room`, so closing that thread shows the room again.
  const openThread = (rootId: string) =>
    void setSplit({ thread: rootId, room: null });
  const openSplitThread = (rootId: string) => void setSplit({ thread: rootId });

  const panel = threadId ? (
    <ThreadPanel
      key={threadId}
      roomId={splitRoomId ?? roomId}
      threadId={threadId}
      menu={threadMenu}
      onClose={closeThread}
    />
  ) : (
    splitRoomId && (
      <OpenThread value={openSplitThread}>
        <ConversationSplit
          key={splitRoomId}
          roomId={splitRoomId}
          onClose={() => void setSplit({ room: null })}
        />
      </OpenThread>
    )
  );

  const layout = (
    <OpenThread value={openThread}>
      <div className="relative h-full min-h-0">
        {children}
        {panel && !docked && (
          <div className="bg-background absolute inset-0 z-20">{panel}</div>
        )}
        {/* Keyed, so another thread mounts anew and shows over a panel that covered the last one. */}
        {panel && docked && (
          <SidePanel key={threadId ?? splitRoomId}>{panel}</SidePanel>
        )}
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
