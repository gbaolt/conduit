'use client';

import { type AnswerSource, plainText } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@conduit/ui/components/collapsible';
import { Skeleton } from '@conduit/ui/components/skeleton';
import {
  IconChevronRight,
  IconHash,
  IconPencil,
  IconUser,
} from '@tabler/icons-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { FileKindIcon } from '@/components/file-kind-icon';
import { useAuthors } from '@/features/messages/hooks/use-authors';
import { useRoomName } from '@/features/messages/hooks/use-room-name';

import { sourceHref } from '../lib/source-href';

const sentFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function RoomName({
  room,
}: {
  room: { id: string; name: string; kind: string };
}) {
  const { title } = useRoomName(room.id);
  if (room.kind !== 'dm') return <>#{room.name}</>;
  return title ? <>{title}</> : <Skeleton className="inline-block h-3 w-16" />;
}

/** What a source shows: its first line, then where and when, or what kind of thing it is. */
function sourceText({
  source,
  names,
}: {
  source: AnswerSource;
  names: Record<string, string>;
}): { title: ReactNode; meta: ReactNode } {
  const icon = 'text-muted-foreground size-4 shrink-0';
  const titled = (glyph: ReactNode, text: string) => (
    <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
      {glyph}
      <span className="truncate">{text}</span>
    </span>
  );
  switch (source.type) {
    case 'message':
      return {
        title: (
          <span className="line-clamp-2 text-sm">
            {plainText(source.message.body, names)}
          </span>
        ),
        meta: (
          <>
            <RoomName room={source.message.room} /> ·{' '}
            {source.message.author.name} ·{' '}
            {sentFormat.format(source.message.createdAt)}
          </>
        ),
      };
    case 'file':
      return {
        title: titled(
          <FileKindIcon
            contentType={source.file.contentType}
            className={icon}
          />,
          source.file.name
        ),
        meta: (
          <>
            <RoomName room={source.file.room} /> · {source.file.uploader.name} ·{' '}
            {sentFormat.format(source.file.createdAt)}
          </>
        ),
      };
    case 'channel':
      return {
        title: titled(
          <IconHash aria-hidden className={icon} />,
          source.channel.name
        ),
        meta: source.channel.topic || 'Channel',
      };
    case 'person':
      return {
        title: titled(
          <IconUser aria-hidden className={icon} />,
          source.person.name
        ),
        meta: 'Workspace member',
      };
    case 'draft':
      return {
        title: (
          <span className="flex min-w-0 items-start gap-1.5 text-sm">
            <IconPencil aria-hidden className={`${icon} mt-0.5`} />
            <span className="line-clamp-2">
              {plainText(source.draft.body, names)}
            </span>
          </span>
        ),
        meta: (
          <>
            Your draft · #{source.draft.room.name} ·{' '}
            {sentFormat.format(source.draft.updatedAt)}
          </>
        ),
      };
  }
}

function SourceRow({
  source,
  number,
  names,
  onOpen,
}: {
  source: AnswerSource;
  number: number;
  names: Record<string, string>;
  onOpen: () => void;
}) {
  const { title, meta } = sourceText({ source, names });
  return (
    <li>
      <Link
        href={sourceHref(source)}
        onClick={onOpen}
        className="hover:bg-muted dark:hover:bg-muted/50 focus-visible:bg-muted -mx-2 flex gap-3 rounded-lg px-2 py-2 outline-none"
      >
        <span className="text-link w-4 shrink-0 text-sm font-medium tabular-nums">
          {number}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          {title}
          <span className="text-muted-foreground truncate text-xs">{meta}</span>
        </span>
      </Link>
    </li>
  );
}

const sourceKey = (source: AnswerSource) => {
  switch (source.type) {
    case 'message':
      return `m:${source.message.id}`;
    case 'file':
      return `f:${source.file.id}`;
    case 'channel':
      return `c:${source.channel.id}`;
    case 'person':
      return `p:${source.person.id}`;
    case 'draft':
      return `d:${source.draft.room.id}/${source.draft.parentId ?? ''}`;
  }
};

/** What the answer cites, numbered as its `[n]` links are, behind a toggle that names how many. */
export function AskSources({
  sources,
  defaultOpen,
  onOpen,
}: {
  sources: readonly AnswerSource[];
  defaultOpen: boolean;
  onOpen: () => void;
}) {
  const { names } = useAuthors();
  const mentionNames = Object.fromEntries(names);
  if (sources.length === 0) return null;

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground self-start [&>svg]:transition-transform [&>svg]:duration-150 [&[data-panel-open]>svg]:rotate-90"
          />
        }
      >
        <IconChevronRight data-icon="inline-start" />
        {sources.length} {sources.length === 1 ? 'source' : 'sources'}
      </CollapsibleTrigger>
      <CollapsibleContent render={<ol className="flex flex-col pt-1" />}>
        {sources.map((source, index) => (
          <SourceRow
            key={sourceKey(source)}
            source={source}
            number={index + 1}
            names={mentionNames}
            onOpen={onOpen}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
