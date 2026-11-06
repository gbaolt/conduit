import {
  createChannelSectionContract,
  deleteChannelSectionContract,
  listChannelSectionsContract,
  renameChannelSectionContract,
  reorderChannelSectionsContract,
} from './contracts/channel-sections';
import {
  addChannelMembersContract,
  archiveChannelContract,
  createChannelContract,
  deleteChannelContract,
  getChannelContract,
  joinChannelContract,
  leaveChannelContract,
  listChannelMembersContract,
  listChannelsContract,
  moveChannelToSectionContract,
  removeChannelMemberContract,
  renameChannelContract,
  starChannelContract,
  unstarChannelContract,
  setChannelMemberRoleContract,
  updateChannelContract,
  setChannelVisibilityContract,
  unarchiveChannelContract,
} from './contracts/channels';
import { healthCheckContract } from './contracts/health';
import {
  acceptInvitationContract,
  createOrganizationContract,
  deactivateMemberContract,
  listInvitationsContract,
  listMembersContract,
  listOrganizationsContract,
  reactivateMemberContract,
  removeMemberContract,
  updateMemberRoleContract,
} from './contracts/organizations';
import { getSessionContract } from './contracts/users';

export const contract = {
  health: {
    check: healthCheckContract,
  },
  users: {
    getSession: getSessionContract,
  },
  organizations: {
    list: listOrganizationsContract,
    create: createOrganizationContract,
  },
  members: {
    list: listMembersContract,
    updateRole: updateMemberRoleContract,
    remove: removeMemberContract,
    deactivate: deactivateMemberContract,
    reactivate: reactivateMemberContract,
  },
  invitations: {
    list: listInvitationsContract,
    accept: acceptInvitationContract,
  },
  channels: {
    list: listChannelsContract,
    get: getChannelContract,
    create: createChannelContract,
    rename: renameChannelContract,
    delete: deleteChannelContract,
    join: joinChannelContract,
    leave: leaveChannelContract,
    update: updateChannelContract,
    members: {
      list: listChannelMembersContract,
      add: addChannelMembersContract,
      remove: removeChannelMemberContract,
      setRole: setChannelMemberRoleContract,
    },
    archive: archiveChannelContract,
    unarchive: unarchiveChannelContract,
    setVisibility: setChannelVisibilityContract,
    star: starChannelContract,
    unstar: unstarChannelContract,
    moveToSection: moveChannelToSectionContract,
  },
  channelSections: {
    list: listChannelSectionsContract,
    create: createChannelSectionContract,
    rename: renameChannelSectionContract,
    delete: deleteChannelSectionContract,
    reorder: reorderChannelSectionsContract,
  },
};
