import type {
  ChannelSection,
  Dm,
  Room,
  RoomMembership,
} from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import { groupSidebar, sidebarDrop, type SidebarItem } from '../sidebar-groups';

const membership = (patch: Partial<RoomMembership> = {}): RoomMembership => ({
  role: 'member',
  starredAt: null,
  sectionId: null,
  notify: null,
  mutedAt: null,
  closedAt: null,
  ...patch,
});

function channel(
  name: string,
  patch: Partial<RoomMembership> | null = {},
  isDefault = false
): Room {
  return {
    id: name,
    organizationId: 'o1',
    kind: 'channel',
    name,
    topic: null,
    description: null,
    visibility: 'public',
    isDefault,
    archivedAt: null,
    memberCount: 1,
    createdById: null,
    createdAt: new Date(0),
    archivedByName: null,
    membership: patch && membership(patch),
  };
}

function dm(
  id: string,
  patch: Partial<RoomMembership> = {},
  lastMessageAt: Date | null = null
): Dm {
  return {
    id,
    members: [],
    lastMessageAt,
    createdAt: new Date(0),
    membership: membership(patch),
  };
}

const starred = { starredAt: new Date(0) };
const section = (id: string, position: number): ChannelSection => ({
  id,
  name: id,
  position,
});

const group = (input: Partial<Parameters<typeof groupSidebar>[0]>) =>
  groupSidebar({ channels: [], dms: [], sections: [], ...input }).map(
    ({ id, items }) => [id, items.map((item) => item.id)]
  );

describe('groupSidebar', () => {
  it('always lists Starred, Channels and Direct messages, even when empty', () => {
    expect(group({})).toEqual([
      ['starred', []],
      ['channels', []],
      ['dms', []],
    ]);
  });

  it('puts the default channel first, then sorts by name', () => {
    const groups = group({
      channels: [
        channel('design'),
        channel('all-acme', {}, true),
        channel('build'),
      ],
    });

    expect(groups[1]).toEqual(['channels', ['all-acme', 'build', 'design']]);
  });

  it('hides channels the viewer is not in', () => {
    expect(group({ channels: [channel('open', null)] })[1]).toEqual([
      'channels',
      [],
    ]);
  });

  it('shows a starred channel only under Starred, and back in its section once unstarred', () => {
    const sections = [section('p', 0)];

    expect(
      group({
        channels: [
          channel('design', { ...starred, sectionId: 'p' }),
          channel('build'),
        ],
        sections,
      })
    ).toEqual([
      ['starred', ['design']],
      ['p', []],
      ['channels', ['build']],
      ['dms', []],
    ]);
    expect(
      group({ channels: [channel('design', { sectionId: 'p' })], sections })[1]
    ).toEqual(['p', ['design']]);
  });

  it('orders sections by position and keeps an empty one', () => {
    const groups = group({ sections: [section('b', 1), section('a', 0)] });

    expect(groups.map(([id]) => id)).toEqual([
      'starred',
      'a',
      'b',
      'channels',
      'dms',
    ]);
  });

  it('falls back to Channels for a section the viewer does not have', () => {
    expect(
      group({ channels: [channel('design', { sectionId: 'gone' })] })[1]
    ).toEqual(['channels', ['design']]);
  });

  it('lists starred channels before starred DMs, and a starred DM only under Starred', () => {
    expect(
      group({
        channels: [channel('design', starred)],
        dms: [dm('ana', starred), dm('bo')],
      })
    ).toEqual([
      ['starred', ['design', 'ana']],
      ['channels', []],
      ['dms', ['bo']],
    ]);
  });

  it('orders DMs by their latest message, preferring the live time', () => {
    const groups = group({
      dms: [
        dm('old', {}, new Date(1)),
        dm('new', {}, new Date(2)),
        dm('live', {}, null),
      ],
      lastMessageAt: { live: new Date(3) },
    });

    expect(groups[2]).toEqual(['dms', ['live', 'new', 'old']]);
  });

  it('leaves out a closed DM until a message arrives after the close', () => {
    const closed = { closedAt: new Date(10) };

    expect(group({ dms: [dm('ana', closed, new Date(5))] })[2]).toEqual([
      'dms',
      [],
    ]);
    expect(group({ dms: [dm('ana', closed, new Date(20))] })[2]).toEqual([
      'dms',
      ['ana'],
    ]);
    expect(
      group({
        dms: [dm('ana', closed, new Date(5))],
        lastMessageAt: { ana: new Date(20) },
      })[2]
    ).toEqual(['dms', ['ana']]);
  });

  it('keeps a closed DM listed while it is the open room, and under Starred when starred', () => {
    const closed = { closedAt: new Date(10) };

    expect(group({ dms: [dm('ana', closed)], activeRoomId: 'ana' })[2]).toEqual(
      ['dms', ['ana']]
    );
    expect(group({ dms: [dm('ana', { ...closed, ...starred })] })[0]).toEqual([
      'starred',
      ['ana'],
    ]);
  });
});

describe('sidebarDrop', () => {
  const channelItem = (patch: Partial<RoomMembership> = {}): SidebarItem => ({
    kind: 'channel',
    id: 'design',
    channel: channel('design', patch),
  });
  const dmItem = (patch: Partial<RoomMembership> = {}): SidebarItem => ({
    kind: 'dm',
    id: 'ana',
    dm: dm('ana', patch),
  });
  const starredGroup = { kind: 'starred', section: null } as const;
  const channelsGroup = { kind: 'channels', section: null } as const;
  const dmsGroup = { kind: 'dms', section: null } as const;
  const sectionGroup = { kind: 'section', section: section('p', 0) } as const;

  it('stars any row dropped on Starred, and ignores one already there', () => {
    expect(sidebarDrop(channelItem(), starredGroup)).toEqual({ starred: true });
    expect(sidebarDrop(dmItem(), starredGroup)).toEqual({ starred: true });
    expect(sidebarDrop(dmItem(starred), starredGroup)).toBeNull();
  });

  it('unstars a DM dropped on Direct messages, and takes nothing else there', () => {
    expect(sidebarDrop(dmItem(starred), dmsGroup)).toEqual({ starred: false });
    expect(sidebarDrop(dmItem(), dmsGroup)).toBeNull();
    expect(sidebarDrop(channelItem(), dmsGroup)).toBeNull();
  });

  it('never files a DM under Channels or a section', () => {
    expect(sidebarDrop(dmItem(starred), channelsGroup)).toBeNull();
    expect(sidebarDrop(dmItem(), sectionGroup)).toBeNull();
  });

  it('moves a channel between Channels and a section', () => {
    expect(sidebarDrop(channelItem(), sectionGroup)).toEqual({
      sectionId: 'p',
    });
    expect(sidebarDrop(channelItem({ sectionId: 'p' }), channelsGroup)).toEqual(
      { sectionId: null }
    );
    expect(
      sidebarDrop(channelItem({ sectionId: 'p' }), sectionGroup)
    ).toBeNull();
    expect(sidebarDrop(channelItem(), channelsGroup)).toBeNull();
  });

  it('unstars a starred channel dropped on its own group, and also files it when the group differs', () => {
    expect(sidebarDrop(channelItem(starred), channelsGroup)).toEqual({
      starred: false,
    });
    expect(sidebarDrop(channelItem(starred), sectionGroup)).toEqual({
      starred: false,
      sectionId: 'p',
    });
  });
});
