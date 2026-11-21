import type { Dm, Room, SidebarEntry } from '@conduit/contract';
import { defaultFilter } from 'cmdk';
import type { Route } from 'next';

import { isUnread } from '@/services/activity/queries';
import { dmTitle } from '@/services/dms/dm-title';

/** One conversation the quick switcher can open. */
export type SwitcherRoom = {
  id: string;
  kind: 'channel' | 'private' | 'dm';
  label: string;
  /** What the footer strip shows while the row is highlighted. */
  detail: string;
  href: Route;
  starred: boolean;
  unread: boolean;
  lastReadAt: number;
  lastMessageAt: number;
};

const RECENT_MAX = 5;
/** Starred conversations win a tie, without outranking a better match. */
const STARRED_BONUS = 0.001;
const time = (date: Date | null | undefined) => date?.getTime() ?? 0;

/** The viewer's channels and DMs, plus public channels they haven't joined. */
export function switcherRooms({
  channels,
  dms,
  entries,
  viewerId,
}: {
  channels: readonly Room[];
  dms: readonly Dm[];
  entries: readonly SidebarEntry[];
  viewerId: string;
}): SwitcherRoom[] {
  const entryOf = new Map(entries.map((entry) => [entry.roomId, entry]));
  const state = (id: string) => {
    const entry = entryOf.get(id);
    return {
      unread: isUnread(entry),
      lastReadAt: time(entry?.lastReadAt ?? entry?.joinedAt),
      lastMessageAt: time(entry?.lastMessageAt),
    };
  };

  const rooms: SwitcherRoom[] = channels
    .filter(
      (channel) =>
        !channel.archivedAt &&
        (channel.membership || channel.visibility === 'public')
    )
    .map((channel) => ({
      id: channel.id,
      kind: channel.visibility === 'private' ? 'private' : 'channel',
      label: channel.name,
      detail:
        channel.topic ||
        `${channel.memberCount} ${channel.memberCount === 1 ? 'member' : 'members'}${channel.membership ? '' : ' · Not joined'}`,
      href: `/channels/${channel.id}` as Route,
      starred: !!channel.membership?.starredAt,
      ...state(channel.id),
    }));

  for (const dm of dms) {
    const label = dmTitle(dm, viewerId);
    rooms.push({
      id: dm.id,
      kind: 'dm',
      label,
      detail: `Direct message with ${label}`,
      href: `/dm/${dm.id}` as Route,
      starred: !!dm.membership.starredAt,
      ...state(dm.id),
    });
  }
  return rooms;
}

/** What an empty query shows: the conversations read most recently, the other unread ones newest first, then the rest. */
export function emptyQueryRooms(rooms: readonly SwitcherRoom[]) {
  const recent = [...rooms]
    .filter((room) => room.lastReadAt > 0)
    .sort((a, b) => b.lastReadAt - a.lastReadAt)
    .slice(0, RECENT_MAX);
  const shown = new Set(recent.map((room) => room.id));
  const unread = [...rooms]
    .filter((room) => room.unread && !shown.has(room.id))
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  for (const room of unread) shown.add(room.id);
  const rest = rooms.filter((room) => !shown.has(room.id));
  return { recent, unread, rest };
}

/** cmdk's fuzzy score for a typed query, with starred conversations breaking ties. */
export function switcherScore(room: SwitcherRoom, search: string) {
  const score = defaultFilter(room.label, search);
  return score > 0 && room.starred ? score + STARRED_BONUS : score;
}
