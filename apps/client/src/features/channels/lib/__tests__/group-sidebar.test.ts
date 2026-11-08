import type { Channel, ChannelSection } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import { groupSidebar } from '../group-sidebar';

function channel(
  name: string,

  membership: Partial<NonNullable<Channel['membership']>> | null = {},
  isDefault = false
): Channel {
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
    membership: membership && {
      role: 'member',
      starredAt: null,
      sectionId: null,
      ...membership,
    },
  };
}

const starred = { starredAt: new Date(0) };
const section = (id: string, position: number): ChannelSection => ({
  id,
  name: id,
  position,
});

const names = (groups: ReturnType<typeof groupSidebar>) =>
  groups.map((group) => [group.id, group.channels.map((c) => c.name)]);

describe('groupSidebar', () => {
  it('puts the default channel first, then sorts by name, with no sections', () => {
    const groups = groupSidebar(
      [channel('design'), channel('all-acme', {}, true), channel('build')],
      []
    );

    expect(names(groups)).toEqual([
      ['channels', ['all-acme', 'build', 'design']],
    ]);
  });

  it('hides channels the viewer is not in', () => {
    expect(names(groupSidebar([channel('open', null)], []))).toEqual([
      ['channels', []],
    ]);
  });

  it('lists Starred first, and a starred channel in a section shows only there', () => {
    const groups = groupSidebar(
      [channel('design', { ...starred, sectionId: 'p' }), channel('build')],
      [section('p', 0)]
    );

    expect(names(groups)).toEqual([
      ['starred', ['design']],
      ['p', []],
      ['channels', ['build']],
    ]);
  });

  it('returns a channel to its section when it is unstarred', () => {
    const groups = groupSidebar(
      [channel('design', { sectionId: 'p' })],
      [section('p', 0)]
    );

    expect(names(groups)).toEqual([
      ['p', ['design']],
      ['channels', []],
    ]);
  });

  it('orders sections by position and keeps an empty one', () => {
    const groups = groupSidebar([], [section('b', 1), section('a', 0)]);

    expect(names(groups)).toEqual([
      ['a', []],
      ['b', []],
      ['channels', []],
    ]);
  });

  it('puts a starred default channel first under Starred', () => {
    const groups = groupSidebar(
      [channel('aaa', starred), channel('all-acme', starred, true)],
      []
    );

    expect(names(groups)[0]).toEqual(['starred', ['all-acme', 'aaa']]);
  });

  it('falls back to Channels for a section the viewer does not have', () => {
    const groups = groupSidebar([channel('design', { sectionId: 'gone' })], []);

    expect(names(groups)).toEqual([['channels', ['design']]]);
  });

  it('does not filter on archivedAt', () => {
    const archived = { ...channel('old'), archivedAt: new Date(0) };

    expect(names(groupSidebar([archived], []))).toEqual([
      ['channels', ['old']],
    ]);
  });
});
