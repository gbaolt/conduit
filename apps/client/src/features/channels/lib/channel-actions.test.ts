import type { Channel, WorkspaceRole } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import { getChannelActions } from './channel-actions';

type Kind = 'default' | 'public' | 'private';

function channel(
  kind: Kind,
  membership: 'manager' | 'member' | null,
  archivedAt: Date | null = null
): Channel {
  return {
    id: 'c1',
    organizationId: 'o1',
    name: 'design',
    topic: null,
    description: null,
    visibility: kind === 'private' ? 'private' : 'public',
    isDefault: kind === 'default',
    archivedAt,
    memberCount: 3,
    createdById: null,
    createdAt: new Date(0),
    membership: membership && {
      role: membership,
      starredAt: null,
      sectionId: null,
    },
    archivedByName: null,
  };
}

const ids = (
  workspaceRole: WorkspaceRole,
  kind: Kind,
  membership: 'manager' | 'member' | null,
  archivedAt: Date | null = null
) =>
  getChannelActions(channel(kind, membership, archivedAt), {
    workspaceRole,
  }).map((action) => action.id);

const COPY = ['copy-name', 'copy-link'];
const DETAILS = ['details'];
const ADD = ['add-members'];

describe('getChannelActions', () => {
  it.each(['owner', 'admin'] as const)(
    'gives a workspace %s every action, except leave and delete on the default channel',
    (role) => {
      expect(ids(role, 'default', 'member')).toEqual([
        ...COPY,
        'rename',
        ...DETAILS,
      ]);
      expect(ids(role, 'public', 'member')).toEqual([
        ...COPY,
        'rename',
        'leave',
        'delete',
        ...DETAILS,
        ...ADD,
        'archive',
        'make-private',
      ]);
      expect(ids(role, 'private', 'member')).toEqual([
        ...COPY,
        'rename',
        'leave',
        'delete',
        ...DETAILS,
        ...ADD,
        'archive',
        'make-public',
      ]);
    }
  );

  it('keeps delete, and making a channel public, from a channel manager', () => {
    expect(ids('member', 'public', 'manager')).toEqual([
      ...COPY,
      'rename',
      'leave',
      ...DETAILS,
      ...ADD,
      'archive',
      'make-private',
    ]);
    expect(ids('member', 'private', 'manager')).toEqual([
      ...COPY,
      'rename',
      'leave',
      ...DETAILS,
      ...ADD,
      'archive',
    ]);
  });

  it('offers unarchive, not rename or archive, on an archived channel', () => {
    expect(ids('admin', 'public', 'member', new Date(0))).toEqual([
      ...COPY,
      'leave',
      'delete',
      ...DETAILS,
      'unarchive',
    ]);
  });

  it('gives a plain member copy, leave, details, and add people', () => {
    const expected = [...COPY, 'leave', ...DETAILS, ...ADD];
    expect(ids('member', 'public', 'member')).toEqual(expected);
    expect(ids('member', 'private', 'member')).toEqual(expected);
  });

  it('gives a member copy and details only on the default channel', () => {
    expect(ids('member', 'default', 'member')).toEqual([...COPY, ...DETAILS]);
  });

  it('shows details but not add people to someone outside the channel', () => {
    expect(ids('member', 'public', null)).toEqual([...COPY, ...DETAILS]);
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
