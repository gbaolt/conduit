import type { Dm, Room, SidebarEntry } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import {
  commandMenuRooms,
  commandMenuScore,
  emptyQueryRooms,
} from '../command-menu-rooms';

const membership = (starred = false) => ({
  role: 'member' as const,
  starredAt: starred ? new Date(0) : null,
  sectionId: null,
  notify: null,
  mutedAt: null,
  closedAt: null,
});

const channel = (
  name: string,
  { joined = true, starred = false, visibility = 'public' as const } = {}
): Room => ({
  id: name,
  organizationId: 'o1',
  kind: 'channel',
  name,
  topic: null,
  description: null,
  visibility,
  permissions: {
    post: 'everyone',
    reply: 'everyone',
    mentionEveryone: 'everyone',
  },
  isDefault: false,
  archivedAt: null,
  memberCount: 3,
  createdById: null,
  createdAt: new Date(0),
  archivedByName: null,
  membership: joined ? membership(starred) : null,
});

const dm = (id: string, name: string): Dm => ({
  id,
  members: [
    { userId: 'me', name: 'Me', image: null },
    { userId: id, name, image: null },
  ] as Dm['members'],
  lastMessageAt: null,
  createdAt: new Date(0),
  membership: membership(),
});

const entry = (
  roomId: string,
  readAt: number,
  messageAt: number | null = null
): SidebarEntry => ({
  roomId,
  lastMessageAt: messageAt === null ? null : new Date(messageAt),
  joinedAt: new Date(0),
  lastReadAt: new Date(readAt),
  hasDraft: false,
  mutedAt: null,
  lastAuthorId: null,
  lastBody: null,
});

describe('commandMenuRooms', () => {
  it('lists joined channels, DMs, and public channels not joined', () => {
    const rooms = commandMenuRooms({
      channels: [channel('design'), channel('launch', { joined: false })],
      dms: [dm('linh', 'Linh')],
      entries: [],
      viewerId: 'me',
    });

    expect(rooms.map((room) => [room.label, room.href, room.detail])).toEqual([
      ['design', '/channels/design', '3 members'],
      ['launch', '/channels/launch', '3 members · Not joined'],
      ['Linh', '/dm/linh', 'Direct message with Linh'],
    ]);
  });
});

describe('emptyQueryRooms', () => {
  it('shows the rooms read most recently, then the other unread ones, then the rest', () => {
    const rooms = commandMenuRooms({
      channels: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((name) =>
        channel(name)
      ),
      dms: [],
      entries: [
        entry('a', 10),
        entry('b', 70),
        entry('c', 30),
        entry('d', 60),
        entry('e', 50),
        entry('f', 40),
        // Read longest ago, so out of Recent, and unread.
        entry('g', 1, 5),
        entry('h', 2, 9),
      ],
      viewerId: 'me',
    });

    const { recent, unread, rest } = emptyQueryRooms(rooms);

    expect(recent.map((room) => room.id)).toEqual(['b', 'd', 'e', 'f', 'c']);
    expect(unread.map((room) => room.id)).toEqual(['h', 'g']);
    expect(rest.map((room) => room.id)).toEqual(['a']);
  });
});

describe('commandMenuScore', () => {
  it('ranks a better match first, and a starred room first among equal matches', () => {
    const rooms = commandMenuRooms({
      channels: [
        channel('design-review'),
        channel('design', { starred: true }),
        channel('designs'),
        channel('marketing'),
      ],
      dms: [],
      entries: [],
      viewerId: 'me',
    });
    const ranked = rooms
      .map((room) => [room.label, commandMenuScore(room, 'des')] as const)
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([label]) => label);

    expect(ranked[0]).toBe('design');
    expect(ranked).not.toContain('marketing');
    const design = rooms[1]!;
    expect(commandMenuScore(design, 'des')).toBeGreaterThan(
      commandMenuScore({ ...design, starred: false }, 'des')
    );
    expect(commandMenuScore(design, 'zzz')).toBe(0);
  });
});
