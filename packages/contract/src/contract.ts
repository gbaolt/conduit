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
  removeChannelMemberContract,
  renameChannelContract,
  setChannelMemberRoleContract,
  updateChannelContract,
  setChannelVisibilityContract,
  unarchiveChannelContract,
} from './contracts/channels';
import { healthCheckContract } from './contracts/health';
import {
  acceptInvitationContract,
  createOrganizationContract,
  listInvitationsContract,
  listOrganizationsContract,
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
  },
};
