import type { Room, WorkspaceMember } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import { findChannels, findInvitations, findPeople } from '../directory';

const member = (
  name: string,
  extra: Partial<WorkspaceMember> = {}
): WorkspaceMember => ({
  memberId: name,
  userId: name,
  name,
  email: `${name.toLowerCase()}@example.com`,
  image: null,
  role: 'member',
  status: 'active',
  joinedAt: new Date('2026-01-01'),
  ...extra,
});

const channel = (name: string, extra: Partial<Room> = {}): Room => ({
  id: name,
  organizationId: 'org',
  kind: 'channel',
  name,
  topic: null,
  description: null,
  visibility: 'public',
  isDefault: false,
  archivedAt: null,
  memberCount: 1,
  createdById: null,
  createdAt: new Date('2026-01-01'),
  membership: null,
  archivedByName: null,
  ...extra,
});

const people = { q: '', role: 'any', account: 'active', sort: 'a-z' } as const;
const channels = { q: '', show: 'all', type: 'any', sort: 'a-z' } as const;

describe('findPeople', () => {
  const members = [
    member('Cleo', { role: 'admin' }),
    member('Ana', { email: 'boss@corp.io', joinedAt: new Date('2026-03-01') }),
    member('Bo', { status: 'deactivated' }),
  ];

  it('hides deactivated accounts and sorts by name', () => {
    expect(findPeople(members, people).map((m) => m.name)).toEqual([
      'Ana',
      'Cleo',
    ]);
  });

  it('matches the search against the email and filters by role', () => {
    expect(findPeople(members, { ...people, q: 'boss' })).toHaveLength(1);
    expect(
      findPeople(members, { ...people, role: 'admin' }).map((m) => m.name)
    ).toEqual(['Cleo']);
  });

  it('lists the deactivated and the recently joined', () => {
    expect(
      findPeople(members, { ...people, account: 'deactivated' }).map(
        (m) => m.name
      )
    ).toEqual(['Bo']);
    expect(findPeople(members, { ...people, sort: 'newest' })[0]?.name).toBe(
      'Ana'
    );
  });
});

describe('findChannels', () => {
  const joined = {
    role: 'member',
    starredAt: null,
    sectionId: null,
    notify: null,
    mutedAt: null,
  } as const;
  const list = [
    channel('social', { memberCount: 9, description: 'Fun things' }),
    channel('general', { membership: joined, memberCount: 2 }),
    channel('secret', { visibility: 'private', membership: joined }),
  ];

  it('splits joined from other channels and private from public', () => {
    expect(
      findChannels(list, { ...channels, show: 'other' }).map((c) => c.name)
    ).toEqual(['social']);
    expect(
      findChannels(list, { ...channels, type: 'private' }).map((c) => c.name)
    ).toEqual(['secret']);
  });

  it('searches descriptions, ignores a leading # and sorts by members', () => {
    expect(findChannels(list, { ...channels, q: 'fun' })).toHaveLength(1);
    expect(findChannels(list, { ...channels, q: '#gen' })).toHaveLength(1);
    expect(
      findChannels(list, { ...channels, sort: 'most-members' })[0]?.name
    ).toBe('social');
  });
});

describe('findInvitations', () => {
  const invite = (email: string, role: string, expires: string) => ({
    id: email,
    email,
    role,
    inviterName: 'Mai Tran',
    expiresAt: new Date(expires),
  });
  const list = [
    invite('zoe@x.io', 'member', '2026-11-20'),
    invite('ana@x.io', 'admin', '2026-11-22'),
  ];
  const all = { q: '', role: 'any', sort: 'expires-soon' } as const;

  it('puts the invitation that expires first on top', () => {
    expect(findInvitations(list, all).map((i) => i.email)).toEqual([
      'zoe@x.io',
      'ana@x.io',
    ]);
  });

  it('filters by role and searches the inviter', () => {
    expect(
      findInvitations(list, { ...all, role: 'admin' }).map((i) => i.email)
    ).toEqual(['ana@x.io']);
    expect(findInvitations(list, { ...all, q: 'mai' })).toHaveLength(2);
    expect(findInvitations(list, { ...all, q: 'nobody' })).toHaveLength(0);
  });
});
