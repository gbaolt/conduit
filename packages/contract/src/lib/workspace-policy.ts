import type { WorkspaceRole } from '@/schemas/organizations';

/** The member an action lands on. `newRole` is set when the action changes their role. */
export type PolicyMember = {
  role: WorkspaceRole;
  newRole?: WorkspaceRole;
  isSelf?: boolean;
};

type Rule = {
  allow: (actorRole: WorkspaceRole, target?: PolicyMember) => boolean;
};

const isAdmin = (role: WorkspaceRole) => role !== 'member';
const adminOnly: Rule['allow'] = (role) => isAdmin(role);

// Only an owner may touch an owner or grant the role, as Better Auth enforces.
const touchesOwner = (target?: PolicyMember) =>
  target?.role === 'owner' || target?.newRole === 'owner';
const adminOnMember: Rule['allow'] = (role, target) =>
  isAdmin(role) && (!touchesOwner(target) || role === 'owner');
const adminOnOtherMember: Rule['allow'] = (role, target) =>
  adminOnMember(role, target) && !target?.isSelf;

export const workspacePolicy = {
  viewSettings: { allow: adminOnly },
  invite: { allow: adminOnly },
  revokeInvitation: { allow: adminOnly },
  changeRole: { allow: adminOnMember },
  removeMember: { allow: adminOnOtherMember },
  deactivate: { allow: adminOnOtherMember },
  reactivate: { allow: adminOnMember },
  editWorkspace: { allow: adminOnly },
  editPermissions: { allow: adminOnly },
  manageJoinLink: { allow: adminOnly },
  manageAllowedDomains: { allow: adminOnly },
} satisfies Record<string, Rule>;

export type WorkspaceAction = keyof typeof workspacePolicy;

export function canWorkspace(
  action: WorkspaceAction,
  actorRole: WorkspaceRole,
  target?: PolicyMember
) {
  const rule: Rule = workspacePolicy[action];
  return rule.allow(actorRole, target);
}
