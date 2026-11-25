'use client';

import type { MessageHit } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { Skeleton } from '@conduit/ui/components/skeleton';
import {
  IconArrowRight,
  IconHash,
  IconLock,
  IconMessage,
  IconTrash,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { MessageExcerpt } from '@/features/messages/components/message/message-excerpt';
import { MentionNames } from '@/features/messages/context/mention-names';
import { useAuthors } from '@/features/messages/hooks/use-authors';
import { useRoomName } from '@/features/messages/hooks/use-room-name';
import { messagePath } from '@/features/messages/lib/message-link';
import { canvasEmbeddedMessageQuery } from '@/services/canvases/queries';

function CanvasMessageEmbedFrame({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background overflow-hidden rounded-lg border">
      {children}
    </div>
  );
}

/** Says why a message does not show, without anything of the message itself. */
function CanvasMessageEmbedNotice({
  icon: Icon,
  children,
}: {
  icon: typeof IconLock;
  children: ReactNode;
}) {
  return (
    <CanvasMessageEmbedFrame>
      <p className="text-muted-foreground flex items-center gap-2 px-4 py-3 text-sm">
        <Icon className="size-4 shrink-0" aria-hidden />
        {children}
      </p>
    </CanvasMessageEmbedFrame>
  );
}

function CanvasMessageEmbedDmName({ roomId }: { roomId: string }) {
  const { title } = useRoomName(roomId);
  return title ? <>{title}</> : <Skeleton className="inline-block h-3 w-20" />;
}

function CanvasMessageEmbedCard({ message }: { message: MessageHit }) {
  const { names } = useAuthors();
  const isDm = message.room.kind === 'dm';
  const Glyph = isDm ? IconMessage : IconHash;

  return (
    <CanvasMessageEmbedFrame>
      <MentionNames value={names}>
        <MessageExcerpt
          message={message}
          author={message.author}
          context={
            <span className="text-muted-foreground mb-0.5 flex w-fit items-center gap-0.5 text-xs">
              <Glyph className="size-3.5" aria-hidden />
              {isDm ? (
                <CanvasMessageEmbedDmName roomId={message.room.id} />
              ) : (
                message.room.name
              )}
              {message.parentId && <span>, in a thread</span>}
            </span>
          }
          className="px-4 py-3"
        >
          <Button
            variant="link"
            size="xs"
            nativeButton={false}
            render={
              <Link
                href={messagePath({
                  ...message,
                  roomId: message.room.id,
                  kind: message.room.kind,
                })}
              />
            }
            className="text-link mt-1 h-auto px-0"
          >
            Jump to message
            <IconArrowRight data-icon="inline-end" />
          </Button>
        </MessageExcerpt>
      </MentionNames>
    </CanvasMessageEmbedFrame>
  );
}

/** A message embedded in a canvas, loaded for the viewer with their own access to its conversation. */
export function CanvasMessageEmbed({
  canvasId,
  messageId,
}: {
  canvasId: string;
  messageId: string;
}) {
  const embed = useQuery(canvasEmbeddedMessageQuery(canvasId, messageId));

  if (embed.isPending) {
    return (
      <CanvasMessageEmbedFrame>
        <div
          role="status"
          aria-label="Loading message"
          className="flex gap-3 px-4 py-3"
        >
          <Skeleton className="size-9 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        </div>
      </CanvasMessageEmbedFrame>
    );
  }
  if (embed.isError) {
    return (
      <CanvasMessageEmbedFrame>
        <p className="text-muted-foreground px-4 py-3 text-sm">
          Couldn&apos;t load this message.{' '}
          <Button variant="link" size="xs" onClick={() => void embed.refetch()}>
            Retry
          </Button>
        </p>
      </CanvasMessageEmbedFrame>
    );
  }
  if (embed.data.status === 'inaccessible') {
    return (
      <CanvasMessageEmbedNotice icon={IconLock}>
        Message from a channel you cannot access
      </CanvasMessageEmbedNotice>
    );
  }
  if (embed.data.status === 'deleted') {
    return (
      <CanvasMessageEmbedNotice icon={IconTrash}>
        This message was deleted
      </CanvasMessageEmbedNotice>
    );
  }
  return <CanvasMessageEmbedCard message={embed.data.message} />;
}
