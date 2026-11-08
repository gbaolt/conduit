'use client';

import { Button } from '@conduit/ui/components/button';
import { IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import { useConversationName } from '@/services/channels/hooks';
import { threadRootQuery } from '@/services/messages/queries';

import { Conversation } from './conversation';

/** One thread: its root, the replies, and a composer that replies in it. */
export function ThreadPanel({
  channelId,
  threadId,
  onClose,
}: {
  channelId: string;
  threadId: string;
  onClose: () => void;
}) {
  const { title } = useConversationName(channelId);
  const root = useQuery(threadRootQuery(threadId));
  // A link can name a message that is gone, in another channel, or itself a reply.
  const missing =
    root.isError ||
    (root.data && (root.data.channelId !== channelId || root.data.parentId));

  return (
    <section
      aria-label="Thread"
      className="flex h-full min-h-0 flex-col"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) onClose();
      }}
    >
      <header className="flex min-h-12 shrink-0 items-center gap-2 border-b px-4 py-1.5">
        <h2 className="text-sm font-semibold">Thread</h2>
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-[13px]">
          {title}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Close thread"
          className="ml-auto pointer-coarse:size-11"
          onClick={onClose}
        >
          <IconX />
        </Button>
      </header>
      {missing ? (
        <p className="text-muted-foreground p-4 text-sm">
          This thread isn&apos;t available.
        </p>
      ) : (
        <Conversation channelId={channelId} parentId={threadId} start={null} />
      )}
    </section>
  );
}
