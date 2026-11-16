'use client';

import { Button } from '@conduit/ui/components/button';
import { IconArrowLeft, IconMessage, IconX } from '@tabler/icons-react';
import { parseAsString, useQueryStates } from 'nuqs';
import { Suspense, useCallback } from 'react';

import { SidePanel } from '@/components/side-panel';
import { Conversation } from '@/features/messages/components/conversation/conversation';
import { ConversationLoading } from '@/features/messages/components/conversation/conversation-loading';
import { OpenThread } from '@/features/messages/context/thread';
import { useRoomName } from '@/features/messages/hooks/use-room-name';
import { useMediaQuery } from '@/hooks/use-media-query';

/** What the Saved page shows beside its list: a `thread`, or a `room` scrolled to `message`. Only one at a time. */
export const savedSplitParams = {
  thread: parseAsString,
  room: parseAsString,
  message: parseAsString,
};

function SavedRoomPanelContent({
  roomId,
  onClose,
}: {
  roomId: string;
  onClose: () => void;
}) {
  const { title, isDm } = useRoomName(roomId);

  return (
    <section
      aria-label="Conversation"
      className="flex h-full min-h-0 flex-col"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) onClose();
      }}
    >
      <header className="flex min-h-12 shrink-0 items-center gap-2 border-b px-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back to saved"
          className="-ms-2 xl:hidden pointer-coarse:size-11"
          onClick={onClose}
        >
          <IconArrowLeft />
        </Button>
        <h2 className="ml-2 flex min-w-0 flex-1 items-center gap-2 font-semibold">
          {isDm && <IconMessage className="size-4 shrink-0" aria-hidden />}
          <span className="truncate">{title}</span>
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close conversation"
          className="max-xl:hidden pointer-coarse:size-11"
          onClick={onClose}
        >
          <IconX />
        </Button>
      </header>
      <Suspense fallback={<ConversationLoading />}>
        <Conversation roomId={roomId} start={null} />
      </Suspense>
    </section>
  );
}

/** The room named by `?room=` beside the Saved list from xl up. Narrower, it covers the list until closed. */
export function SavedRoomPanel() {
  const [{ room }, setSplit] = useQueryStates(savedSplitParams);
  const docked = useMediaQuery('(min-width: 80rem)');
  // A reply button in the room swaps the room for its thread, so the two never claim the side card at once.
  const openThread = useCallback(
    (rootId: string) => void setSplit({ thread: rootId, room: null }),
    [setSplit]
  );

  if (!room) return null;

  const panel = (
    <OpenThread value={openThread}>
      <SavedRoomPanelContent
        key={room}
        roomId={room}
        onClose={() => void setSplit({ room: null })}
      />
    </OpenThread>
  );

  return docked ? (
    <SidePanel>{panel}</SidePanel>
  ) : (
    <div className="bg-background absolute inset-0 z-20">{panel}</div>
  );
}
