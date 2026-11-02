import {
  createChannelContract,
  deleteChannelContract,
  getChannelContract,
  joinChannelContract,
  leaveChannelContract,
  listChannelsContract,
  renameChannelContract,
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
  },
};
