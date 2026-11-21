'use client';

import { Button } from '@conduit/ui/components/button';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@conduit/ui/components/command';
import {
  IconHash,
  IconLock,
  IconMessage,
  IconSearch,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  emptyQueryRooms,
  type SwitcherRoom,
  switcherRooms,
  switcherScore,
} from '@/features/rooms/lib/switcher-rooms';
import { sidebarStateQuery } from '@/services/activity/queries';
import { sessionQuery } from '@/services/auth/queries';
import { channelsQuery } from '@/services/channels/queries';
import { dmsQuery } from '@/services/dms/queries';

const GLYPHS = {
  channel: IconHash,
  private: IconLock,
  dm: IconMessage,
} satisfies Record<SwitcherRoom['kind'], typeof IconHash>;

function SwitcherRow({
  room,
  onSelect,
}: {
  room: SwitcherRoom;
  onSelect: (room: SwitcherRoom) => void;
}) {
  const Glyph = GLYPHS[room.kind];
  return (
    <CommandItem
      value={room.id}
      onSelect={() => onSelect(room)}
      className="h-8 py-0"
    >
      <Glyph />
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

const FOCUS_WAIT_MS = 3000;
const SEARCH_ROW = 'search';
// Below any room that matches, so the search row always comes last.
const SEARCH_ROW_SCORE = 1e-6;

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

/** The rail's Search button and the Ctrl+K dialog that jumps to any conversation the viewer can open. */
export function RoomSwitcher() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState('');
  // Set on Enter, so the close hands focus to the opened conversation instead of back where it was.
  const opening = useRef<string | null>(null);
  const router = useRouter();
  const { data: channels = [] } = useQuery(channelsQuery);
  const { data: dms = [] } = useQuery(dmsQuery);
  const { data: entries = [] } = useQuery(sidebarStateQuery);
  const { data: session } = useQuery(sessionQuery);
  const viewerId = session?.user.id ?? '';

  const rooms = useMemo(
    () => switcherRooms({ channels, dms, entries, viewerId }),
    [channels, dms, entries, viewerId]
  );
  const byId = useMemo(
    () => new Map(rooms.map((room) => [room.id, room])),
    [rooms]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== 'k' ||
        !(event.ctrlKey || event.metaKey) ||
        event.shiftKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      setOpen((wasOpen) => !wasOpen);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const select = (room: SwitcherRoom) => {
    opening.current = room.id;
    setOpen(false);
    router.push(room.href);
  };

  const { recent, unread, rest } = emptyQueryRooms(rooms);
  const detail =
    highlighted === SEARCH_ROW
      ? 'Search messages, files, channels, and people'
      : byId.get(highlighted)?.detail;

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="group/rail text-muted-foreground h-auto flex-col gap-1 p-0 text-[10px] font-normal hover:bg-transparent!"
      >
        <span className="group-hover/rail:bg-sidebar-accent flex size-8 items-center justify-center rounded-md">
          <IconSearch className="size-4" />
        </span>
        Search
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        onOpenChangeComplete={(isOpen) => {
          if (isOpen) return;
          setQuery('');
          if (opening.current) focusComposer(opening.current);
          opening.current = null;
        }}
        title="Jump to a conversation"
        description="Type a channel or a person's name."
      >
        <Command
          value={highlighted}
          onValueChange={setHighlighted}
          filter={(value, search) => {
            if (value === SEARCH_ROW) return SEARCH_ROW_SCORE;
            const room = byId.get(value);
            return room ? switcherScore(room, search) : 0;
          }}
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Jump to…"
          />
          <CommandList>
            <CommandEmpty>No conversations match.</CommandEmpty>
            {query ? (
              <>
                {rooms.map((room) => (
                  <SwitcherRow key={room.id} room={room} onSelect={select} />
                ))}
                <CommandItem
                  value={SEARCH_ROW}
                  onSelect={() => {
                    setOpen(false);
                    router.push(
                      `/search?q=${encodeURIComponent(query.trim())}` as Route
                    );
                  }}
                  className="h-8 py-0"
                >
                  <IconSearch />
                  <span className="truncate">Search for “{query.trim()}”</span>
                </CommandItem>
              </>
            ) : (
              <>
                {recent.length > 0 && (
                  <CommandGroup heading="Recent">
                    {recent.map((room) => (
                      <SwitcherRow
                        key={room.id}
                        room={room}
                        onSelect={select}
                      />
                    ))}
                  </CommandGroup>
                )}
                {unread.length > 0 && (
                  <CommandGroup heading="Unread">
                    {unread.map((room) => (
                      <SwitcherRow
                        key={room.id}
                        room={room}
                        onSelect={select}
                      />
                    ))}
                  </CommandGroup>
                )}
                {rest.length > 0 && (
                  <CommandGroup heading="Conversations">
                    {rest.map((room) => (
                      <SwitcherRow
                        key={room.id}
                        room={room}
                        onSelect={select}
                      />
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
          <div className="text-muted-foreground flex h-8 items-center border-t px-3 text-xs">
            <span className="truncate">{detail}</span>
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}
