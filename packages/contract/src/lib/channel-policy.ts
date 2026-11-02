import type { WorkspaceRole } from '@/schemas/organizations';
import type { Channel } from '@/schemas/channels';

export type PolicyChannel = Pick<
  Channel,
  'visibility' | 'isDefault' | 'archivedAt' | 'membership'
>;

type Rule = {
  allow: (workspaceRole: WorkspaceRole, channel: PolicyChannel) => boolean;
  /** Refused on the default channel. */
  lockedOnDefault?: true;
  /** Still allowed on an archived channel; every other write is refused there. */
  openWhenArchived?: true;
};

const isAdmin = (role: WorkspaceRole) => role !== 'member';
const isIn = (channel: PolicyChannel) => channel.membership !== null;
const isManager = (channel: PolicyChannel) =>
  channel.membership?.role === 'manager';
const adminOrManager = (role: WorkspaceRole, channel: PolicyChannel) =>
  isAdmin(role) || isManager(channel);
const anyMember = (_role: WorkspaceRole, channel: PolicyChannel) =>
  isIn(channel);

// Appendix E permission table. The default channel stores everyone as MEMBER, so admins manage it through isAdmin.
export const channelPolicy = {
  view: {
    allow: (_role, channel) => channel.visibility === 'public' || isIn(channel),
    openWhenArchived: true,
  },
  create: { allow: () => true, openWhenArchived: true },
  rename: { allow: adminOrManager },
  editDetails: { allow: (role, channel) => isAdmin(role) || isIn(channel) },
  addMembers: { allow: anyMember, lockedOnDefault: true },
  removeMember: { allow: adminOrManager, lockedOnDefault: true },
  // The default channel's managers are the workspace admins, so it has no channel managers to set.
  setManager: { allow: adminOrManager, lockedOnDefault: true },
  archive: { allow: adminOrManager, lockedOnDefault: true },
  unarchive: {
    allow: (role, channel) =>
      channel.archivedAt !== null && adminOrManager(role, channel),
    openWhenArchived: true,
  },
  makePrivate: {
    allow: (role, channel) =>
      channel.visibility === 'public' && adminOrManager(role, channel),
    lockedOnDefault: true,
  },
  makePublic: {
    allow: (role, channel) => channel.visibility === 'private' && isAdmin(role),
    lockedOnDefault: true,
  },
  delete: { allow: isAdmin, lockedOnDefault: true, openWhenArchived: true },
  // Joining a private channel you are already in is a no-op, not a refusal.
  join: {
    allow: (_role, channel) => channel.visibility === 'public' || isIn(channel),
  },
  leave: { allow: anyMember, lockedOnDefault: true, openWhenArchived: true },
  star: { allow: anyMember, openWhenArchived: true },
  moveToSection: { allow: anyMember },
} satisfies Record<string, Rule>;

export type ChannelAction = keyof typeof channelPolicy;

export type ChannelDenial =
  | 'FORBIDDEN'
  | 'DEFAULT_CHANNEL_LOCKED'
  | 'CHANNEL_ARCHIVED';

export function checkChannel(
  action: ChannelAction,
  workspaceRole: WorkspaceRole,
  channel: PolicyChannel
): ChannelDenial | null {
  const rule: Rule = channelPolicy[action];

  if (rule.lockedOnDefault && channel.isDefault) {
    return 'DEFAULT_CHANNEL_LOCKED';
  }
  if (!rule.openWhenArchived && channel.archivedAt) {
    return 'CHANNEL_ARCHIVED';
  }
  return rule.allow(workspaceRole, channel) ? null : 'FORBIDDEN';
}

export function canChannel(
  action: ChannelAction,
  workspaceRole: WorkspaceRole,
  channel: PolicyChannel
) {
  return checkChannel(action, workspaceRole, channel) === null;
}
