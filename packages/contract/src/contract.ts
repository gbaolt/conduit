import {
  getAiSettingsContract,
  updateAiSettingsContract,
} from './contracts/ai-settings';
import {
  createChannelSectionContract,
  deleteChannelSectionContract,
  listChannelSectionsContract,
  renameChannelSectionContract,
  reorderChannelSectionsContract,
} from './contracts/channel-sections';
import {
  getDraftContract,
  heartbeatContract,
  markReadContract,
  saveDraftContract,
  typingPingContract,
} from './contracts/activity';
import {
  addChannelMembersContract,
  archiveChannelContract,
  createChannelContract,
  deleteChannelContract,
  joinChannelContract,
  leaveChannelContract,
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
import {
  addDmPeopleContract,
  convertDmContract,
  listDmsContract,
  openDmContract,
} from './contracts/dms';
import {
  listFeedContract,
  markAllFeedReadContract,
  markFeedReadContract,
} from './contracts/feed';
import { healthCheckContract } from './contracts/health';
import {
  getNotificationSettingsContract,
  updateNotificationSettingsContract,
} from './contracts/notification-settings';
import {
  deleteMessageContract,
  editMessageContract,
  getMessageContract,
  listMessagesContract,
  listPinnedMessagesContract,
  listRepliesContract,
  listSavedMessagesContract,
  pinMessageContract,
  reactMessageContract,
  removeLinkPreviewContract,
  saveMessageContract,
  sendMessageContract,
  unpinMessageContract,
  unreactMessageContract,
  unsaveMessageContract,
} from './contracts/messages';
import {
  acceptInvitationContract,
  createInvitationsContract,
  createOrganizationContract,
  deactivateMemberContract,
  getInvitationContract,
  getJoinLinkContract,
  joinOrganizationContract,
  joinWithLinkContract,
  listAllowedDomainsContract,
  listInvitationsContract,
  listJoinableOrganizationsContract,
  listMembersContract,
  organizationIconUploadUrlContract,
  listOrganizationsContract,
  listWorkspaceInvitationsContract,
  previewJoinLinkContract,
  reactivateMemberContract,
  removeMemberContract,
  resetJoinLinkContract,
  revokeInvitationContract,
  setAllowedDomainsContract,
  updateMemberRoleContract,
  updateOrganizationContract,
} from './contracts/organizations';
import {
  subscribePushContract,
  unsubscribePushContract,
} from './contracts/push';
import { sealStreamContract } from './contracts/realtime';
import {
  getRoomContract,
  listRoomMembersContract,
  muteRoomContract,
  setRoomNotifyContract,
  unmuteRoomContract,
} from './contracts/rooms';
import {
  getSummaryContract,
  shareSummaryContract,
  summarizeRoomContract,
  summarizeThreadContract,
} from './contracts/summaries';
import { getSessionContract } from './contracts/users';
import {
  getWorkspaceSettingsContract,
  updateWorkspaceSettingsContract,
} from './contracts/workspace-settings';

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
    joinable: listJoinableOrganizationsContract,
    join: joinOrganizationContract,
    update: updateOrganizationContract,
    iconUploadUrl: organizationIconUploadUrlContract,
  },
  joinLink: {
    get: getJoinLinkContract,
    reset: resetJoinLinkContract,
    preview: previewJoinLinkContract,
    join: joinWithLinkContract,
  },
  allowedDomains: {
    list: listAllowedDomainsContract,
    set: setAllowedDomainsContract,
  },
  members: {
    list: listMembersContract,
    updateRole: updateMemberRoleContract,
    remove: removeMemberContract,
    deactivate: deactivateMemberContract,
    reactivate: reactivateMemberContract,
  },
  workspaceSettings: {
    get: getWorkspaceSettingsContract,
    update: updateWorkspaceSettingsContract,
  },
  notificationSettings: {
    get: getNotificationSettingsContract,
    update: updateNotificationSettingsContract,
  },
  push: {
    subscribe: subscribePushContract,
    unsubscribe: unsubscribePushContract,
  },
  aiSettings: {
    get: getAiSettingsContract,
    update: updateAiSettingsContract,
  },
  invitations: {
    list: listInvitationsContract,
    accept: acceptInvitationContract,
    get: getInvitationContract,
    create: createInvitationsContract,
    listForWorkspace: listWorkspaceInvitationsContract,
    revoke: revokeInvitationContract,
  },
  rooms: {
    get: getRoomContract,
    setNotify: setRoomNotifyContract,
    mute: muteRoomContract,
    unmute: unmuteRoomContract,
    members: {
      list: listRoomMembersContract,
    },
  },
  channels: {
    list: listChannelsContract,

    create: createChannelContract,
    rename: renameChannelContract,
    delete: deleteChannelContract,
    join: joinChannelContract,
    leave: leaveChannelContract,
    update: updateChannelContract,
    members: {
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
  messages: {
    list: listMessagesContract,
    get: getMessageContract,
    listReplies: listRepliesContract,
    send: sendMessageContract,
    edit: editMessageContract,
    delete: deleteMessageContract,
    react: reactMessageContract,
    unreact: unreactMessageContract,
    pin: pinMessageContract,
    unpin: unpinMessageContract,
    listPinned: listPinnedMessagesContract,
    removeLinkPreview: removeLinkPreviewContract,
  },
  dms: {
    list: listDmsContract,
    open: openDmContract,
    addPeople: addDmPeopleContract,
    convertToChannel: convertDmContract,
  },
  saved: {
    add: saveMessageContract,
    remove: unsaveMessageContract,
    list: listSavedMessagesContract,
  },
  realtime: {
    seal: sealStreamContract,
  },
  summaries: {
    thread: summarizeThreadContract,
    room: summarizeRoomContract,
    get: getSummaryContract,
    share: shareSummaryContract,
  },
  feed: {
    list: listFeedContract,
    markRead: markFeedReadContract,
    markAllRead: markAllFeedReadContract,
  },
  readState: {
    mark: markReadContract,
  },
  drafts: {
    get: getDraftContract,
    save: saveDraftContract,
  },
  typing: {
    ping: typingPingContract,
  },
  presence: {
    heartbeat: heartbeatContract,
  },
  channelSections: {
    list: listChannelSectionsContract,
    create: createChannelSectionContract,
    rename: renameChannelSectionContract,
    delete: deleteChannelSectionContract,
    reorder: reorderChannelSectionsContract,
  },
};
