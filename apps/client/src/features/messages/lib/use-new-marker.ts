'use client';

import type { Message } from '@conduit/contract';
import { useState } from 'react';

import { useMarkRead, useSidebarEntry } from '@/services/activity/hooks';

import { firstUnreadId } from './first-unread';

/**
 * Decides once, when the conversation opens, which message the New marker sits above. The marker then stays
 * put while the viewer reads, and a message that arrives later does not move it.
 * `markRead` stays undefined until that decision is made, so reading cannot move the read time first.
 */
export function useNewMarker({
  roomId,
  messages,
  viewerId,
  ready,
  hasOlder,
}: {
  roomId: string;
  messages: readonly Message[];
  viewerId: string | null;
  /** The first page of messages has loaded. */
  ready: boolean;
  hasOlder: boolean;
}) {
  const entry = useSidebarEntry(roomId);
  const markRead = useMarkRead(roomId);
  const [markerId, setMarkerId] = useState<string | null>();

  if (markerId === undefined && ready && entry) {
    setMarkerId(
      firstUnreadId(
        messages,
        entry.lastReadAt ?? entry.joinedAt,
        viewerId,
        hasOlder
      )
    );
  }

  return {
    markerId: markerId ?? null,
    markRead: markerId === undefined ? undefined : markRead,
  };
}
