'use client';

import { type AnswerSource, plainText } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@conduit/ui/components/collapsible';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';

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
  const where = source.type === 'message' ? source.message : source.file;
  const who =
    source.type === 'message' ? source.message.author : source.file.uploader;

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
          {source.type === 'file' ? (
            <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
              <FileKindIcon
                contentType={source.file.contentType}
                className="text-muted-foreground size-4 shrink-0"
              />
              <span className="truncate">{source.file.name}</span>
            </span>
          ) : (
            <span className="line-clamp-2 text-sm">
              {plainText(source.message.body, names)}
            </span>
          )}
          <span className="text-muted-foreground truncate text-xs">
            <RoomName room={where.room} /> · {who.name} ·{' '}
            {sentFormat.format(where.createdAt)}
          </span>
        </span>
      </Link>
    </li>
  );
}

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
            className="text-muted-foreground -ms-2 [&>svg]:transition-transform [&>svg]:duration-150 [&[data-panel-open]>svg]:rotate-90"
          />
        }
      >
        <IconChevronRight data-icon="inline-start" />
        {sources.length} {sources.length === 1 ? 'source' : 'sources'}
      </CollapsibleTrigger>
      <CollapsibleContent render={<ol className="flex flex-col pt-1" />}>
        {sources.map((source, index) => (
          <SourceRow
            key={
              source.type === 'message'
                ? `m:${source.message.id}`
                : `f:${source.file.id}`
            }
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
