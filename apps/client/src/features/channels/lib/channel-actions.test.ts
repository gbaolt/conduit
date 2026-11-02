import type { Channel, WorkspaceRole } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import { getChannelActions } from './channel-actions';

type Kind = 'default' | 'public' | 'private';

function channel(kind: Kind, membership: 'manager' | 'member' | null): Channel {
  return {
    id: 'c1',
    organizationId: 'o1',
    name: 'design',
    topic: null,
    description: null,
    visibility: kind === 'private' ? 'private' : 'public',
    isDefault: kind === 'default',
    archivedAt: null,
    memberCount: 3,
    createdById: null,
    createdAt: new Date(0),
    membership: membership && {
      role: membership,
      starredAt: null,
      sectionId: null,
    },
  };
}

const ids = (
  workspaceRole: WorkspaceRole,
  kind: Kind,
  membership: 'manager' | 'member' | null
) =>
  getChannelActions(channel(kind, membership), { workspaceRole }).map(
    (action) => action.id
  );

const COPY = ['copy-name', 'copy-link'];

describe('getChannelActions', () => {
  it.each(['owner', 'admin'] as const)(
    'gives a workspace %s every action, except leave and delete on the default channel',
    (role) => {
      expect(ids(role, 'default', 'member')).toEqual([...COPY, 'rename']);
      expect(ids(role, 'public', 'member')).toEqual([
        ...COPY,
        'rename',
        'leave',
        'delete',
      ]);
      expect(ids(role, 'private', 'member')).toEqual([
        ...COPY,
        'rename',
        'leave',
        'delete',
      ]);
    }
  );

  it('keeps delete from a channel manager', () => {
    expect(ids('member', 'public', 'manager')).toEqual([
      ...COPY,
      'rename',
      'leave',
    ]);
    expect(ids('member', 'private', 'manager')).toEqual([
      ...COPY,
      'rename',
      'leave',
    ]);
  });

  it('gives a plain member copy and leave only', () => {
    expect(ids('member', 'public', 'member')).toEqual([...COPY, 'leave']);
    expect(ids('member', 'private', 'member')).toEqual([...COPY, 'leave']);
  });

  it('gives a member copy only on the default channel', () => {
    expect(ids('member', 'default', 'member')).toEqual(COPY);
  });

  it('flags leave and delete as destructive', () => {
    const actions = getChannelActions(channel('public', 'member'), {
      workspaceRole: 'owner',
    });
    expect(
      actions.filter((action) => action.destructive).map((action) => action.id)
    ).toEqual(['leave', 'delete']);
  });
});
