import {
  type ChannelSection,
  type Dm,
  isDmOpen,
  type Room,
} from '@conduit/contract';

export const STARRED_GROUP_ID = 'starred';
export const CHANNELS_GROUP_ID = 'channels';
export const DMS_GROUP_ID = 'dms';

/** One row of the Home sidebar. `id` is the room id either way. */
export type SidebarItem =
  | { kind: 'channel'; id: string; channel: Room }
  | { kind: 'dm'; id: string; dm: Dm };

export type SidebarGroup = {
  /** A section's own id, or one of the three fixed ids above. */
  id: string;
  kind: 'starred' | 'section' | 'channels' | 'dms';
  name: string;
  /** Set only on a user's own section. */
  section: ChannelSection | null;
  items: SidebarItem[];
};

const isStarred = (item: SidebarItem) =>
  !!(item.kind === 'channel' ? item.channel.membership : item.dm.membership)
    ?.starredAt;

const byDefaultThenName = (a: Room, b: Room) =>
  Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name);

/**
 * The one place that decides which rooms the Home sidebar shows, in which group and in what order: Favorites,
 * the viewer's sections by position, Channels, then Direct messages. A starred room shows only under Favorites.
 * A DM the viewer closed is left out until a message arrives after the close, unless it is the open room.
 */
export function groupSidebar({
  channels,
  dms,
  sections,
  lastMessageAt = {},
  activeRoomId,
}: {
  channels: Room[];
  dms: Dm[];
  sections: ChannelSection[];
  /** The live latest-message time per room, where the sidebar stream has delivered one. */
  lastMessageAt?: Record<string, Date | null | undefined>;
  activeRoomId?: string;
}): SidebarGroup[] {
  const joined = channels
    .filter((channel) => channel.membership !== null)
    .sort(byDefaultThenName)
    .map(
      (channel): SidebarItem => ({ kind: 'channel', id: channel.id, channel })
    );

  const latest = (dm: Dm) => lastMessageAt[dm.id] ?? dm.lastMessageAt;
  const recency = (dm: Dm) => (latest(dm) ?? dm.createdAt).getTime();
  const conversations = [...dms]
    .sort((a, b) => recency(b) - recency(a))
    .map((dm): SidebarItem => ({ kind: 'dm', id: dm.id, dm }));

  const rest = joined.filter((item) => !isStarred(item));
  const sorted = [...sections].sort((a, b) => a.position - b.position);
  const sectionIds = new Set(sorted.map((section) => section.id));
  const sectionOf = (item: SidebarItem) =>
    item.kind === 'channel' ? (item.channel.membership?.sectionId ?? '') : '';

  return [
    {
      id: STARRED_GROUP_ID,
      kind: 'starred',
      name: 'Favorites',
      section: null,
      items: [...joined, ...conversations].filter(isStarred),
    },
    ...sorted.map(
      (section): SidebarGroup => ({
        id: section.id,
        kind: 'section',
        name: section.name,
        section,
        items: rest.filter((item) => sectionOf(item) === section.id),
      })
    ),
    {
      id: CHANNELS_GROUP_ID,
      kind: 'channels',
      name: 'Channels',
      section: null,
      // A sectionId the viewer has no section for (stale cache) falls back here.
      items: rest.filter((item) => !sectionIds.has(sectionOf(item))),
    },
    {
      id: DMS_GROUP_ID,
      kind: 'dms',
      name: 'Direct messages',
      section: null,
      items: conversations.filter(
        (item) =>
          item.kind === 'dm' &&
          !isStarred(item) &&
          (item.id === activeRoomId ||
            isDmOpen(item.dm.membership.closedAt, latest(item.dm) ?? null))
      ),
    },
  ];
}

/** What dropping a row on a group changes. Each field is one request. */
export type SidebarDrop = { starred?: boolean; sectionId?: string | null };

/**
 * The change a drop makes, or null where the group does not take the row. Favorites takes any row. A row leaves
 * Favorites by landing on its own kind's group: a DM on Direct messages, a channel on Channels or a section,
 * which also files it there.
 */
export function sidebarDrop(
  item: SidebarItem,
  target: Pick<SidebarGroup, 'kind' | 'section'>
): SidebarDrop | null {
  const starred = isStarred(item);

  if (target.kind === 'starred') return starred ? null : { starred: true };
  if (target.kind === 'dms') {
    return item.kind === 'dm' && starred ? { starred: false } : null;
  }
  if (item.kind !== 'channel') return null;

  const sectionId = target.section?.id ?? null;
  const drop: SidebarDrop = {
    ...(starred && { starred: false }),
    ...((item.channel.membership?.sectionId ?? null) !== sectionId && {
      sectionId,
    }),
  };
  return Object.keys(drop).length > 0 ? drop : null;
}
