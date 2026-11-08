import type { ChannelSection, Room } from '@conduit/contract';

export const STARRED_GROUP_ID = 'starred';
export const CHANNELS_GROUP_ID = 'channels';

export type SidebarGroup = {
  /** A section's own id, or one of the two fixed ids above. */
  id: string;
  name: string;
  /** Set only on a user's own section. */
  section: ChannelSection | null;
  channels: Room[];
};

const byDefaultThenName = (a: Room, b: Room) =>
  Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name);

/**
 * The one place that decides which channels the sidebar shows, in which group and in what order:
 * Starred, then the viewer's sections by position, then Channels. A starred channel shows only under Starred.
 */
export function groupSidebar(
  channels: Room[],
  sections: ChannelSection[]
): SidebarGroup[] {
  const joined = channels.filter((channel) => channel.membership !== null);
  const starred = joined.filter((channel) => channel.membership?.starredAt);
  const rest = joined.filter((channel) => !channel.membership?.starredAt);
  const sorted = [...sections].sort((a, b) => a.position - b.position);
  const sectionIds = new Set(sorted.map((section) => section.id));

  return [
    ...(starred.length > 0
      ? [
          {
            id: STARRED_GROUP_ID,
            name: 'Starred',
            section: null,
            channels: starred.sort(byDefaultThenName),
          },
        ]
      : []),
    ...sorted.map((section) => ({
      id: section.id,
      name: section.name,
      section,
      channels: rest
        .filter((channel) => channel.membership?.sectionId === section.id)
        .sort(byDefaultThenName),
    })),
    {
      id: CHANNELS_GROUP_ID,
      name: 'Channels',
      section: null,
      // A sectionId the viewer has no section for (stale cache) falls back here.
      channels: rest
        .filter(
          (channel) => !sectionIds.has(channel.membership?.sectionId ?? '')
        )
        .sort(byDefaultThenName),
    },
  ];
}
