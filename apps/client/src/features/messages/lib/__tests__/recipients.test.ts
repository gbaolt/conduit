import { type Dm, DM_MEMBERS_MAX, type Room } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import {
  chipsOf,
  choose,
  detailOf,
  matchesQuery,
  NOBODY,
  type Recipient,
  recipientsOf,
  type To,
} from '../recipients';

const membership: Dm['membership'] = {
  role: 'member',
  starredAt: null,
  sectionId: null,
  notify: null,
  mutedAt: null,
  closedAt: null,
};

const person = (userId: string, isViewer = false): Recipient => ({
  kind: 'person',
  key: `person:${userId}`,
  person: { userId, name: userId, image: null },
  isViewer,
});
const channel = (id: string): Recipient => ({
  kind: 'channel',
  key: `channel:${id}`,
  room: { id, name: id } as Room,
});
const pick = (to: To, row: Recipient) => choose(to, [...chipsOf(to), row]);
const keys = (to: To) => chipsOf(to).map((row) => row.key);

describe('choose', () => {
  it('adds people one by one', () => {
    const to = pick(pick(NOBODY, person('ann')), person('bo'));
    expect(keys(to)).toEqual(['person:ann', 'person:bo']);
  });

  it('lets a channel replace the people', () => {
    const to = pick(pick(NOBODY, person('ann')), channel('general'));
    expect(keys(to)).toEqual(['channel:general']);
  });

  it('lets a person replace the channel', () => {
    const to = pick(pick(NOBODY, channel('general')), person('ann'));
    expect(keys(to)).toEqual(['person:ann']);
  });

  it('turns a group DM into its people without doubles', () => {
    const group: Recipient = {
      kind: 'group',
      key: 'group:dm1',
      people: [person('ann'), person('bo')] as never,
    };
    const to = pick(pick(NOBODY, person('ann')), group);
    expect(keys(to)).toEqual(['person:ann', 'person:bo']);
  });

  it('removes a chip', () => {
    const to = pick(pick(NOBODY, person('ann')), person('bo'));
    expect(keys(choose(to, [person('bo')]))).toEqual(['person:bo']);
    expect(choose(pick(NOBODY, channel('general')), [])).toEqual(NOBODY);
  });

  it('stops at the size of a DM, counting the viewer once', () => {
    let to = NOBODY;
    for (let i = 0; i < DM_MEMBERS_MAX + 2; i++) to = pick(to, person(`p${i}`));
    expect(chipsOf(to)).toHaveLength(DM_MEMBERS_MAX - 1);
  });
});

describe('matchesQuery', () => {
  it('limits # to channels and @ to people', () => {
    expect(matchesQuery(channel('general'), '#gen')).toBe(true);
    expect(matchesQuery(person('genna'), '#gen')).toBe(false);
    expect(matchesQuery(person('genna'), '@gen')).toBe(true);
    expect(matchesQuery(channel('general'), '@gen')).toBe(false);
    expect(matchesQuery(channel('general'), 'GEN')).toBe(true);
  });
});

describe('recipientsOf', () => {
  it('puts the most recent conversation first', () => {
    const at = (day: number) => new Date(2026, 10, day);
    const rows = recipientsOf({
      channels: [{ id: 'c1', name: 'general' } as Room],
      dms: [
        {
          id: 'd1',
          members: [
            { userId: 'me', name: 'me', image: null },
            { userId: 'ann', name: 'ann', image: null },
          ],
          lastMessageAt: at(3),
          createdAt: at(1),
          membership,
        },
        {
          id: 'd2',
          members: ['me', 'ann', 'bo'].map((userId) => ({
            userId,
            name: userId,
            image: null,
          })),
          lastMessageAt: at(1),
          createdAt: at(1),
          membership,
        },
      ],
      people: ['me', 'ann', 'bo'].map((userId) => ({
        userId,
        name: userId,
        image: null,
      })),
      entries: [
        {
          roomId: 'c1',
          lastMessageAt: at(2),
          joinedAt: at(1),
          lastReadAt: null,
          hasDraft: false,
          mutedAt: null,
          lastAuthorId: null,
          lastBody: null,
        },
      ],
      viewerId: 'me',
    });
    expect(rows.map((row) => row.key)).toEqual([
      'person:ann',
      'channel:c1',
      'group:d2',
      'person:bo',
      'person:me',
    ]);
  });
});

describe('detailOf', () => {
  it("shows a person's email, even inside a group DM", () => {
    const rows = recipientsOf({
      channels: [],
      dms: [
        {
          id: 'd1',
          members: ['me', 'ann', 'bo'].map((userId) => ({
            userId,
            name: userId,
            image: null,
          })),
          lastMessageAt: null,
          createdAt: new Date(2026, 10, 1),
          membership,
        },
      ],
      people: [{ userId: 'ann', name: 'ann', image: null, email: 'ann@x.dev' }],
      entries: [],
      viewerId: 'me',
    });
    const group = rows.find((row) => row.kind === 'group');
    const ann = rows.find((row) => row.key === 'person:ann');
    expect(ann && detailOf(ann)).toBe('ann@x.dev');
    expect(group && detailOf(group)).toBe('Group DM, 3 people with you');
    expect(group?.kind === 'group' && group.people[0]?.person.email).toBe(
      'ann@x.dev'
    );
  });

  it("shows a channel's topic, else its description, else its size", () => {
    const room = (fields: Partial<Room>): Recipient => ({
      kind: 'channel',
      key: 'channel:c',
      room: {
        id: 'c',
        name: 'c',
        topic: null,
        description: null,
        ...fields,
      } as Room,
    });
    expect(detailOf(room({ topic: 'Ship it', description: 'd' }))).toBe(
      'Ship it'
    );
    expect(detailOf(room({ description: 'About c' }))).toBe('About c');
    expect(detailOf(room({ memberCount: 1 }))).toBe('1 member');
    expect(detailOf(room({ memberCount: 4 }))).toBe('4 members');
  });
});
