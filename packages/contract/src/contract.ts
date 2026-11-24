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
  canvasLiveblocksAuthContract,
  claimCanvasBootstrapContract,
  createCanvasContract,
  deleteCanvasContract,
  getCanvasContract,
  getChannelCanvasContract,
  listCanvasesContract,
  listCanvasMembersContract,
  removeCanvasMemberContract,
  saveCanvasSnapshotContract,
  shareCanvasContract,
  updateCanvasContract,
  updateCanvasMemberRoleContract,
} from './contracts/canvases';
import {
  getDraftContract,
  heartbeatContract,
  markReadContract,
  markRoomsReadContract,
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
  setChannelMemberRoleContract,
  updateChannelContract,
  setChannelPermissionsContract,
  setChannelVisibilityContract,
  unarchiveChannelContract,
} from './contracts/channels';
import {
  addDmPeopleContract,
  closeDmsContract,
  convertDmContract,
  listDmsContract,
  openDmContract,
} from './contracts/dms';
import {
  listFeedContract,
  markAllFeedReadContract,
  markFeedReadContract,
  markFeedUnreadContract,
  rankFeedContract,
} from './contracts/feed';
import {
  cancelFileContract,
  completeFileContract,
  fileUploadUrlContract,
  fileTextContract,
  fileUrlsContract,
  attachFileContract,
  fileCountsContract,
  listFilesContract,
} from './contracts/files';
import {
  askAttachFileContract,
  askAttachmentUrlContract,
  askQuestionContract,
  completeAskAttachmentContract,
  getAskGuideContract,
  deleteAskChatContract,
  getAskChatContract,
  listAskChatsContract,
} from './contracts/ask';
import { healthCheckContract } from './contracts/health';
import { searchContract } from './contracts/search';
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
  clearSavedMessagesContract,
  listSavedMessagesContract,
  listThreadsContract,
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
  starRoomContract,
  unmuteRoomContract,
  unstarRoomContract,
} from './contracts/rooms';
import {
  catchUpContract,
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
    star: starRoomContract,
    unstar: unstarRoomContract,
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
    setPermissions: setChannelPermissionsContract,
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
  files: {
    uploadUrl: fileUploadUrlContract,
    complete: completeFileContract,
    cancel: cancelFileContract,
    urls: fileUrlsContract,
    text: fileTextContract,
    list: listFilesContract,
    counts: fileCountsContract,
    attach: attachFileContract,
  },
  search: {
    query: searchContract,
  },
  ask: {
    question: askQuestionContract,
    chats: listAskChatsContract,
    chat: getAskChatContract,
    deleteChat: deleteAskChatContract,
    attachmentUrl: askAttachmentUrlContract,
    completeAttachment: completeAskAttachmentContract,
    guide: getAskGuideContract,
    attachFile: askAttachFileContract,
  },
  dms: {
    list: listDmsContract,
    open: openDmContract,
    addPeople: addDmPeopleContract,
    convertToChannel: convertDmContract,
    close: closeDmsContract,
  },
  saved: {
    add: saveMessageContract,
    remove: unsaveMessageContract,
    list: listSavedMessagesContract,
    clear: clearSavedMessagesContract,
  },
  threads: {
    list: listThreadsContract,
  },
  realtime: {
    seal: sealStreamContract,
  },
  summaries: {
    thread: summarizeThreadContract,
    room: summarizeRoomContract,
    catchUp: catchUpContract,
    get: getSummaryContract,
    share: shareSummaryContract,
  },
  feed: {
    list: listFeedContract,
    markRead: markFeedReadContract,
    markUnread: markFeedUnreadContract,
    markAllRead: markAllFeedReadContract,
    rank: rankFeedContract,
  },
  readState: {
    mark: markReadContract,
    markRooms: markRoomsReadContract,
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
  canvases: {
    getChannelCanvas: getChannelCanvasContract,
    list: listCanvasesContract,
    get: getCanvasContract,
    create: createCanvasContract,
    update: updateCanvasContract,
    delete: deleteCanvasContract,
    listMembers: listCanvasMembersContract,
    share: shareCanvasContract,
    updateMemberRole: updateCanvasMemberRoleContract,
    removeMember: removeCanvasMemberContract,
    liveblocksAuth: canvasLiveblocksAuthContract,
    claimBootstrap: claimCanvasBootstrapContract,
    saveSnapshot: saveCanvasSnapshotContract,
  },
  channelSections: {
    list: listChannelSectionsContract,
    create: createChannelSectionContract,
    rename: renameChannelSectionContract,
    delete: deleteChannelSectionContract,
    reorder: reorderChannelSectionsContract,
  },
};
