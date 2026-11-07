import { describe, expect, it } from 'vitest';

import type { WorkspaceRole } from '@/schemas/organizations';

import {
  canWorkspace,
  type PolicyMember,
  type WorkspaceAction,
  workspacePolicy,
} from './workspace-policy';

const actors: WorkspaceRole[] = ['owner', 'admin', 'member'];
const target = (role: WorkspaceRole, rest: Partial<PolicyMember> = {}) => ({
  role,
  ...rest,
});
const verdicts = (action: WorkspaceAction, member?: PolicyMember) =>
  actors.map((actor) => canWorkspace(action, actor, member));

const adminOnly: WorkspaceAction[] = [
  'viewSettings',
  'invite',
  'revokeInvitation',
  'editWorkspace',
  'editPermissions',
  'manageJoinLink',
  'manageAllowedDomains',
];
const memberActions: WorkspaceAction[] = [
  'changeRole',
  'removeMember',
  'deactivate',
  'reactivate',
];

describe('workspacePolicy', () => {
  it.each(adminOnly)('%s is open to owners and admins only', (action) => {
    expect(verdicts(action)).toEqual([true, true, false]);
  });

  it.each(memberActions)(
    '%s on a member is for owners and admins',
    (action) => {
      expect(verdicts(action, target('member'))).toEqual([true, true, false]);
    }
  );

  it.each(memberActions)(
    '%s on an admin is for owners and admins',
    (action) => {
      expect(verdicts(action, target('admin'))).toEqual([true, true, false]);
    }
  );

  it.each(memberActions)('%s on an owner is for owners only', (action) => {
    expect(verdicts(action, target('owner'))).toEqual([true, false, false]);
  });

  it('lets only an owner grant owner', () => {
    expect(
      verdicts('changeRole', target('member', { newRole: 'owner' }))
    ).toEqual([true, false, false]);
  });

  it('lets an admin promote a member to admin', () => {
    expect(
      verdicts('changeRole', target('member', { newRole: 'admin' }))
    ).toEqual([true, true, false]);
  });

  it.each(['removeMember', 'deactivate'] as const)(
    'refuses %s on yourself',
    (action) => {
      expect(verdicts(action, target('owner', { isSelf: true }))).toEqual([
        false,
        false,
        false,
      ]);
    }
  );

  it('covers every action in the table', () => {
    expect(Object.keys(workspacePolicy).sort()).toEqual(
      [...adminOnly, ...memberActions].sort()
    );
  });
});
