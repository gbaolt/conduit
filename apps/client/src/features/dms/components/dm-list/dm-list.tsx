'use client';

import type { Dm, SidebarEntry } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@conduit/ui/components/empty';
import { Field, FieldLabel } from '@conduit/ui/components/field';
import {
  SidebarGroup,
  SidebarInput,
  SidebarMenu,
  SidebarMenuItem,
} from '@conduit/ui/components/sidebar';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { Switch } from '@conduit/ui/components/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@conduit/ui/components/tooltip';
import {
  IconEdit,
  IconListSearch,
  IconMessage,
  IconSearch,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';

import { RoomGroup } from '@/features/rooms/components/room-sidebar';
import { isUnread, sidebarStateQuery } from '@/services/activity/queries';
import { sessionQuery } from '@/services/auth/queries';
import { dmTitle } from '@/services/dms/dm-title';
import { dmsQuery } from '@/services/dms/queries';
import { useWorkspaceMembers } from '@/services/workspaces/hooks';

import { useDmDialogs } from '../../context/dm-dialogs-provider';
import { DmListItem } from './dm-list-item';

const DM_LIST_GROUP_ID = 'dm-list';

const DmListContext = createContext<{
  query: string;
  setQuery: (query: string) => void;
  unreadsOnly: boolean;
  setUnreadsOnly: (unreadsOnly: boolean) => void;
}>({
  query: '',
  setQuery: () => {},
  unreadsOnly: false,
  setUnreadsOnly: () => {},
});

/**
 * The DMs page's list of conversations. Compose `DmListHeader`, `DmListSearch` and `DmListItems` inside
 * it. The search and the Unreads switch filter the items.
 */
export function DmList({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const [unreadsOnly, setUnreadsOnly] = useState(false);

  return (
    <DmListContext value={{ query, setQuery, unreadsOnly, setUnreadsOnly }}>
      {children}
    </DmListContext>
  );
}

/** The list's title, the Unreads switch, and the button that starts a DM. */
export function DmListHeader() {
  const { unreadsOnly, setUnreadsOnly } = use(DmListContext);
  const { open } = useDmDialogs();
  const switchId = useId();

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 pr-2 pl-4">
      <h2 className="min-w-0 flex-1 truncate text-base font-semibold">
        Direct messages
      </h2>
      <Field orientation="horizontal" className="w-auto gap-2">
        <FieldLabel
          htmlFor={switchId}
          className="text-muted-foreground cursor-pointer text-xs font-normal"
        >
          Unreads
        </FieldLabel>
        <Switch
          id={switchId}
          checked={unreadsOnly}
          onCheckedChange={setUnreadsOnly}
        />
      </Field>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="New message"
              onClick={() => open({ kind: 'new-dm' })}
            />
          }
        >
          <IconEdit />
        </TooltipTrigger>
        <TooltipContent>New message</TooltipContent>
      </Tooltip>
    </div>
  );
}

/** Filters the items by the names of the people in each DM. */
export function DmListSearch() {
  const { query, setQuery } = use(DmListContext);

  return (
    <div className="relative shrink-0 px-2 pb-2">
      <IconListSearch className="text-muted-foreground pointer-events-none absolute top-4 left-4 size-4 -translate-y-1/2" />
      <SidebarInput
        type="search"
        placeholder="Find a DM..."
        aria-label="Find a DM"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="pl-8"
      />
    </div>
  );
}

const MINUTE_MS = 60_000;

/** The current time, read again every minute so "12 min" keeps counting. */
function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), MINUTE_MS);
    return () => clearInterval(timer);
  }, []);

  return now;
}

type DmRow = { dm: Dm; entry: SidebarEntry | undefined; at: Date };

/**
 * The viewer's DMs, newest message first. The `sidebar` stream keeps the order, the unread state and the
 * preview live. Until it delivers, the DM list's own `lastMessageAt` orders them.
 */
export function DmListItems() {
  const { query, unreadsOnly } = use(DmListContext);
  const { data: dms = [] } = useQuery(dmsQuery);
  const { data: entries = [] } = useQuery(sidebarStateQuery);
  const { data: session } = useQuery(sessionQuery);
  const { data: members = [] } = useWorkspaceMembers();
  const { roomId: activeRoomId } = useParams<{ roomId?: string }>();
  const now = useMinuteClock();
  const viewerId = session?.user.id ?? '';

  const names = useMemo(
    () =>
      Object.fromEntries([
        ...members.map((member) => [member.userId, member.name] as const),
        ...dms.flatMap((dm) =>
          dm.members.map((member) => [member.userId, member.name] as const)
        ),
      ]),
    [members, dms]
  );

  const rows = useMemo(() => {
    const byRoom = new Map(entries.map((entry) => [entry.roomId, entry]));
    return dms
      .map((dm): DmRow => {
        const entry = byRoom.get(dm.id);
        return {
          dm,
          entry,
          at: entry?.lastMessageAt ?? dm.lastMessageAt ?? dm.createdAt,
        };
      })
      .sort((a, b) => b.at.getTime() - a.at.getTime());
  }, [dms, entries]);

  const needle = query.trim().toLowerCase();
  const shown = rows.filter(
    ({ dm, entry }) =>
      (!needle || dmTitle(dm, viewerId).toLowerCase().includes(needle)) &&
      // The open DM stays listed, so the viewer keeps their place.
      (!unreadsOnly || isUnread(entry) || dm.id === activeRoomId)
  );

  if (dms.length === 0) return <DmListEmpty />;
  if (shown.length === 0) {
    return needle ? (
      <DmListNoMatches title="No DMs match" description="Try another name." />
    ) : (
      <DmListNoMatches
        title="You're all caught up"
        description="Every direct message has been read."
      />
    );
  }

  return (
    <RoomGroup id={DM_LIST_GROUP_ID}>
      <SidebarMenu className="gap-0.5">
        {shown.map(({ dm, entry, at }) => (
          <DmListItem
            key={dm.id}
            dm={dm}
            entry={entry}
            at={at}
            now={now}
            viewerId={viewerId}
            names={names}
          />
        ))}
      </SidebarMenu>
    </RoomGroup>
  );
}

/** The viewer has no DMs yet. */
function DmListEmpty() {
  const { open } = useDmDialogs();

  return (
    <Empty className="flex-1 border-0 px-4">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconMessage />
        </EmptyMedia>
        <EmptyTitle>No direct messages yet</EmptyTitle>
        <EmptyDescription>
          Message one person or a small group, or keep notes to yourself.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" onClick={() => open({ kind: 'new-dm' })}>
          <IconEdit data-icon="inline-start" />
          New message
        </Button>
      </EmptyContent>
    </Empty>
  );
}

/** The search or the Unreads switch leaves nothing to show. */
function DmListNoMatches({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Empty className="flex-1 border-0 px-4">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconSearch />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

// Fixed widths: a random width would differ between the server and the client render.
const SKELETON_ROWS = [
  ['w-24', 'w-40'],
  ['w-32', 'w-36'],
  ['w-20', 'w-44'],
  ['w-28', 'w-32'],
] as const;

/** Stands in for `DmListItems`: rows of an avatar, a name line and a preview line. */
export function DmListSkeleton() {
  return (
    <SidebarGroup aria-hidden>
      <SidebarMenu className="gap-0.5">
        {SKELETON_ROWS.map(([name, preview]) => (
          <SidebarMenuItem key={name} className="flex gap-2.5 p-2">
            <Skeleton className="size-9 shrink-0 rounded-md" />
            <div className="flex flex-1 flex-col gap-2 pt-0.5">
              <Skeleton className={`h-4 ${name}`} />
              <Skeleton className={`h-3 ${preview}`} />
            </div>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
