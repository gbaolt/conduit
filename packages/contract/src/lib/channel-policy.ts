import type { WorkspaceRole } from '@/schemas/organizations';
import type { Channel } from '@/schemas/channels';
import type { WorkspaceSettings } from '@/schemas/workspace-settings';

export type PolicyChannel = Pick<
  Channel,
  'kind' | 'visibility' | 'isDefault' | 'archivedAt' | 'membership'
>;

type Rule = {
  allow: (workspaceRole: WorkspaceRole, channel: PolicyChannel) => boolean;
  /** Refused on the default channel. */
  lockedOnDefault?: true;
  /** Still allowed on an archived channel; every other write is refused there. */
  openWhenArchived?: true;
  /** Refused on a DM, which has no managers, name, or settings of its own. */
  notInDm?: true;
};

const isAdmin = (role: WorkspaceRole) => role !== 'member';
const isIn = (channel: PolicyChannel) => channel.membership !== null;
const isManager = (channel: PolicyChannel) =>
  channel.membership?.role === 'manager';
const adminOrManager = (role: WorkspaceRole, channel: PolicyChannel) =>
  isAdmin(role) || isManager(channel);
const anyMember = (_role: WorkspaceRole, channel: PolicyChannel) =>
  isIn(channel);
const memberOfDm = (_role: WorkspaceRole, channel: PolicyChannel) =>
  channel.kind === 'dm' && isIn(channel);

// Appendix E permission table. The default channel stores everyone as MEMBER, so admins manage it through isAdmin.
// A DM is private, so only its members view it, and not even a workspace admin outside it can.
export const channelPolicy = {
  view: {
    allow: (_role, channel) => channel.visibility === 'public' || isIn(channel),
    openWhenArchived: true,
  },
  rename: { allow: adminOrManager, notInDm: true },
  editDetails: {
    allow: (role, channel) => isAdmin(role) || isIn(channel),
    notInDm: true,
  },
  addMembers: { allow: anyMember, lockedOnDefault: true, notInDm: true },
  removeMember: {
    allow: adminOrManager,
    lockedOnDefault: true,
    notInDm: true,
  },
  // The default channel's managers are the workspace admins, so it has no channel managers to set.
  setManager: { allow: adminOrManager, lockedOnDefault: true, notInDm: true },
  archive: { allow: adminOrManager, lockedOnDefault: true, notInDm: true },
  unarchive: {
    allow: (role, channel) =>
      channel.archivedAt !== null && adminOrManager(role, channel),
    openWhenArchived: true,
    notInDm: true,
  },
  makePrivate: {
    allow: (role, channel) =>
      channel.visibility === 'public' && adminOrManager(role, channel),
    lockedOnDefault: true,
    notInDm: true,
  },
  makePublic: {
    allow: (role, channel) => channel.visibility === 'private' && isAdmin(role),
    lockedOnDefault: true,
    notInDm: true,
  },
  delete: {
    allow: isAdmin,
    lockedOnDefault: true,
    openWhenArchived: true,
    notInDm: true,
  },
  // Joining a private channel you are already in is a no-op, not a refusal.
  join: {
    allow: (_role, channel) => channel.visibility === 'public' || isIn(channel),
  },
  // A DM's people are fixed by its key, so nobody leaves one. Turn it into a channel to change who is in it.
  leave: {
    allow: anyMember,
    lockedOnDefault: true,
    openWhenArchived: true,
    notInDm: true,
  },
  star: { allow: anyMember, openWhenArchived: true, notInDm: true },
  post: { allow: anyMember },
  deleteOthersMessages: { allow: adminOrManager, notInDm: true },
  moveToSection: { allow: anyMember, notInDm: true },
  addDmPeople: { allow: memberOfDm },
  convertDm: { allow: memberOfDm },
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

  if (rule.notInDm && channel.kind === 'dm') {
    return 'FORBIDDEN';
  }
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

/** Creating a channel has no channel yet, so it is decided by the workspace settings rather than `channelPolicy`. */
export function canCreateChannel(
  workspaceRole: WorkspaceRole,
  visibility: Channel['visibility'],
  settings: WorkspaceSettings
) {
  if (isAdmin(workspaceRole)) return true;

  return (
    settings.channelCreators === 'everyone' &&
    (visibility === 'private' || settings.publicChannelCreators === 'everyone')
  );
}
