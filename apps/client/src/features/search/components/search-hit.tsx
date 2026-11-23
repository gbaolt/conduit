'use client';

import type { ChannelHit, MessageHit, PersonHit } from '@conduit/contract';
import { Badge } from '@conduit/ui/components/badge';
import { Button } from '@conduit/ui/components/button';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { IconHash, IconLock, IconMessage } from '@tabler/icons-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { UserAvatar } from '@/components/user-avatar';
import { MessageExcerpt } from '@/features/messages/components/message/message-excerpt';
import { useRoomName } from '@/features/messages/hooks/use-room-name';
import { useOpenDm } from '@/services/dms/hooks';

/** The element each hit puts in the arrow-key order. */
export const HIT_ATTRIBUTE = 'data-search-hit';
const hit = { [HIT_ATTRIBUTE]: '' };

const roomBase = (room: MessageHit['room']) =>
  `${room.kind === 'dm' ? '/dms' : '/channels'}/${room.id}`;

/** The message in its conversation, or in its thread panel for a reply. */
function messageHref(message: MessageHit): Route {
  const params = new URLSearchParams();
  if (message.parentId) params.set('thread', message.parentId);
  params.set('message', message.id);
  return `${roomBase(message.room)}?${params}` as Route;
}

function DmName({ roomId }: { roomId: string }) {
  const { title } = useRoomName(roomId);
  return title ? <>{title}</> : <Skeleton className="inline-block h-3 w-20" />;
}

export function SearchHitMessage({
  message,
  terms,
}: {
  message: MessageHit;
  terms: string[];
}) {
  const Glyph = message.room.kind === 'dm' ? IconMessage : IconHash;
  return (
    <MessageExcerpt
      message={message}
      author={message.author}
      highlight={terms}
      context={
        <Link
          {...hit}
          href={messageHref(message)}
          className="text-link mb-0.5 flex w-fit items-center gap-0.5 text-xs hover:underline"
        >
          <Glyph className="size-3.5" aria-hidden />
          {message.room.kind === 'dm' ? (
            <DmName roomId={message.room.id} />
          ) : (
            message.room.name
          )}
          {message.parentId && (
            <span className="text-muted-foreground">, in a thread</span>
          )}
        </Link>
      }
      className="hover:bg-muted dark:hover:bg-muted/50 has-[[data-search-hit]:focus-visible]:bg-muted rounded-lg px-4 py-3"
    />
  );
}

export function SearchHitChannel({ channel }: { channel: ChannelHit }) {
  const Glyph = channel.visibility === 'private' ? IconLock : IconHash;
  return (
    <Link
      {...hit}
      href={`/channels/${channel.id}`}
      className="hover:bg-muted dark:hover:bg-muted/50 focus-visible:bg-muted flex min-h-14 items-center gap-3 rounded-lg px-4 py-2 outline-none"
    >
      <Glyph className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2 font-medium">
          <span className="truncate">{channel.name}</span>
          {!channel.joined && <Badge variant="outline">Not joined</Badge>}
        </span>
        <span className="text-muted-foreground truncate text-xs">
          {channel.topic ||
            `${channel.memberCount} ${channel.memberCount === 1 ? 'member' : 'members'}`}
        </span>
      </span>
    </Link>
  );
}

export function SearchHitPerson({
  person,
  isSelf,
}: {
  person: PersonHit;
  isSelf: boolean;
}) {
  const router = useRouter();
  const openDm = useOpenDm();
  return (
    <Button
      {...hit}
      variant="ghost"
      disabled={openDm.isPending}
      aria-label={isSelf ? 'Message yourself' : `Message ${person.name}`}
      onClick={() =>
        openDm.mutate(
          { userIds: isSelf ? [] : [person.id] },
          {
            onSuccess: (dm) => router.push(`/dms/${dm.id}`),
            onError: (error) => toast.error(error.message),
          }
        )
      }
      className="h-auto min-h-14 w-full justify-start gap-3 rounded-lg px-4 py-2 text-left font-normal"
    >
      <UserAvatar name={person.name} image={person.image} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">
          {person.name}
          {isSelf && (
            <span className="text-muted-foreground font-normal"> (you)</span>
          )}
        </span>
        <span className="text-muted-foreground truncate text-xs">
          {person.email}
        </span>
      </span>
    </Button>
  );
}
