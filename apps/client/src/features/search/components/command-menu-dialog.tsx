'use client';

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@conduit/ui/components/command';
import { Empty, EmptyMedia, EmptyTitle } from '@conduit/ui/components/empty';
import { Kbd } from '@conduit/ui/components/kbd';
import { Separator } from '@conduit/ui/components/separator';
import {
  IconCornerDownLeft,
  IconHash,
  IconLock,
  IconMessage,
  IconSearch,
  IconSearchOff,
  IconSparkles,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';

import { useAsk } from '@/features/ask/context/ask-provider';
import { sidebarStateQuery } from '@/services/activity/queries';
import { sessionQuery } from '@/services/auth/queries';
import { channelsQuery } from '@/services/channels/queries';
import { dmsQuery } from '@/services/dms/queries';

import { useCommandMenu } from '../context/command-menu-provider';
import {
  type CommandMenuRoom,
  commandMenuRooms,
  commandMenuScore,
  emptyQueryRooms,
} from '../lib/command-menu-rooms';

const GLYPHS = {
  channel: IconHash,
  private: IconLock,
  dm: IconMessage,
} satisfies Record<CommandMenuRoom['kind'], typeof IconHash>;

const SEARCH_ROW = 'search';
// Below any room that matches, so the search row always comes last.
const SEARCH_ROW_SCORE = 1e-6;
const SEARCH_DETAIL = 'Search messages, files, channels, and people';
const ASK_ROW = 'ask';
const ASK_ROW_SCORE = SEARCH_ROW_SCORE / 2;
const ASK_DETAIL = 'Answer from the messages and files you can access';

/** What Enter does on the highlighted row, as the footer names it. */
const ENTER_LABELS = {
  channel: 'Open channel',
  private: 'Open channel',
  dm: 'Open DM',
  search: 'Search',
  ask: 'Ask',
} satisfies Record<
  CommandMenuRoom['kind'] | typeof SEARCH_ROW | typeof ASK_ROW,
  string
>;

const FOCUS_WAIT_MS = 3000;

/** Focuses the conversation's composer once its route has rendered it, or gives up. */
function focusComposer(roomId: string) {
  const started = performance.now();
  const attempt = () => {
    const field = document.querySelector<HTMLElement>(
      `[data-room-composer="${CSS.escape(roomId)}"] [contenteditable="true"]`
    );
    if (field) field.focus();
    else if (performance.now() - started < FOCUS_WAIT_MS)
      requestAnimationFrame(attempt);
  };
  attempt();
}

function CommandMenuDialogRoom({
  room,
  onSelect,
}: {
  room: CommandMenuRoom;
  onSelect: (room: CommandMenuRoom) => void;
}) {
  const Glyph = GLYPHS[room.kind];
  return (
    <CommandItem value={room.id} onSelect={() => onSelect(room)}>
      <Glyph className="text-muted-foreground" />
      <span className="truncate">{room.label}</span>
      {room.unread && (
        <>
          <span className="sr-only">, unread</span>
          <span
            aria-hidden
            className="bg-primary ml-auto size-2 shrink-0 rounded-full"
          />
        </>
      )}
    </CommandItem>
  );
}

function CommandMenuDialogGroup({
  heading,
  rooms,
  onSelect,
}: {
  heading: string;
  rooms: CommandMenuRoom[];
  onSelect: (room: CommandMenuRoom) => void;
}) {
  return (
    rooms.length > 0 && (
      <CommandGroup heading={heading}>
        {rooms.map((room) => (
          <CommandMenuDialogRoom
            key={room.id}
            room={room}
            onSelect={onSelect}
          />
        ))}
      </CommandGroup>
    )
  );
}

/** The highlighted row's detail, and what Enter and Esc do. */
function CommandMenuDialogFooter({
  detail,
  action,
}: {
  detail?: string;
  action?: string;
}) {
  return (
    <div className="-mb-1 flex h-10 shrink-0 items-center gap-2 px-3 text-xs font-medium">
      <span className="text-muted-foreground min-w-0 flex-1 truncate">
        {detail}
      </span>
      <div className="flex shrink-0 items-center gap-2 max-sm:hidden">
        {action && (
          <>
            <span>{action}</span>
            <Kbd>
              <IconCornerDownLeft />
            </Kbd>
            <Separator
              orientation="vertical"
              className="data-vertical:h-4 data-vertical:self-center"
            />
          </>
        )}
        <span className="text-muted-foreground">Exit</span>
        <Kbd>Esc</Kbd>
      </div>
    </div>
  );
}

/** Jumps to any conversation the viewer can open, and hands a typed query to the search page. */
export function CommandMenuDialog() {
  const { open, setOpen } = useCommandMenu();
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState('');
  // Set on Enter, so the close hands focus to the opened conversation instead of back where it was.
  const opening = useRef<string | null>(null);
  const router = useRouter();
  const { available: canAsk, openAsk } = useAsk();
  const { data: channels = [] } = useQuery(channelsQuery);
  const { data: dms = [] } = useQuery(dmsQuery);
  const { data: entries = [] } = useQuery(sidebarStateQuery);
  const { data: session } = useQuery(sessionQuery);
  const viewerId = session?.user.id ?? '';

  const rooms = useMemo(
    () => commandMenuRooms({ channels, dms, entries, viewerId }),
    [channels, dms, entries, viewerId]
  );
  const byId = useMemo(
    () => new Map(rooms.map((room) => [room.id, room])),
    [rooms]
  );

  const select = (room: CommandMenuRoom) => {
    opening.current = room.id;
    setOpen(false);
    router.push(room.href);
  };

  const { recent, unread, rest } = emptyQueryRooms(rooms);
  const active = byId.get(highlighted);
  const searching = highlighted === SEARCH_ROW;
  const asking = highlighted === ASK_ROW;

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) return;
        setQuery('');
        if (opening.current) focusComposer(opening.current);
        opening.current = null;
      }}
      title="Search Conduit"
      description="Jump to a channel or DM, or search messages and files."
    >
      <Command
        value={highlighted}
        onValueChange={setHighlighted}
        filter={(value, search) => {
          if (value === SEARCH_ROW) return SEARCH_ROW_SCORE;
          if (value === ASK_ROW) return ASK_ROW_SCORE;
          const room = byId.get(value);
          return room ? commandMenuScore(room, search) : 0;
        }}
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search or jump to…"
        />
        <div className="bg-background ring-border mx-1 rounded-md ring-1">
          <CommandList className="dark:bg-background/50 min-h-80 rounded-lg">
            <CommandEmpty>
              <Empty className="h-full gap-2">
                <EmptyMedia variant="icon">
                  <IconSearchOff />
                </EmptyMedia>
                <EmptyTitle>No conversations yet</EmptyTitle>
              </Empty>
            </CommandEmpty>
            {query ? (
              <CommandGroup>
                {rooms.map((room) => (
                  <CommandMenuDialogRoom
                    key={room.id}
                    room={room}
                    onSelect={select}
                  />
                ))}
                <CommandItem
                  value={SEARCH_ROW}
                  onSelect={() => {
                    setOpen(false);
                    router.push(
                      `/search?q=${encodeURIComponent(query.trim())}` as Route
                    );
                  }}
                >
                  <IconSearch className="text-muted-foreground" />
                  <span className="truncate">Search for “{query.trim()}”</span>
                </CommandItem>
                {canAsk && (
                  <CommandItem
                    value={ASK_ROW}
                    onSelect={() => {
                      setOpen(false);
                      openAsk(query, { submit: true });
                    }}
                  >
                    <IconSparkles className="text-muted-foreground" />
                    <span className="truncate">
                      Ask Conduit “{query.trim()}”
                    </span>
                  </CommandItem>
                )}
              </CommandGroup>
            ) : (
              <>
                <CommandMenuDialogGroup
                  heading="Recent"
                  rooms={recent}
                  onSelect={select}
                />
                <CommandMenuDialogGroup
                  heading="Unread"
                  rooms={unread}
                  onSelect={select}
                />
                <CommandMenuDialogGroup
                  heading="Conversations"
                  rooms={rest}
                  onSelect={select}
                />
              </>
            )}
          </CommandList>
        </div>
        <CommandMenuDialogFooter
          {...(searching || asking
            ? {
                detail: searching ? SEARCH_DETAIL : ASK_DETAIL,
                action: ENTER_LABELS[highlighted as 'search' | 'ask'],
              }
            : {
                detail: active?.detail,
                action: active && ENTER_LABELS[active.kind],
              })}
        />
      </Command>
    </CommandDialog>
  );
}
