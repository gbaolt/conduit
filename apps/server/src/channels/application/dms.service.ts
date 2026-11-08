import {
  type ChannelAction,
  checkChannel,
  DM_MEMBERS_MAX,
  type WorkspaceRole,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { dmError } from '@/channels/domain/channel-errors';
import { ChannelsRepository } from '@/channels/domain/channels.repository';
import { DmsRepository } from '@/channels/domain/dms.repository';
import { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';

export type DmViewer = {
  userId: string;
  organizationId: string;
  workspaceRole: WorkspaceRole;
};

@Injectable()
export class DmsService {
  constructor(
    @Inject(DmsRepository) private readonly dms: DmsRepository,
    @Inject(ChannelsRepository) private readonly channels: ChannelsRepository,
    @Inject(WorkspaceMembersRepository)
    private readonly workspaceMembers: WorkspaceMembersRepository
  ) {}

  list(viewer: DmViewer) {
    return this.dms.list(viewer);
  }

  /** The viewer is always in the DM they open, so no people at all opens the self DM. */
  async open(viewer: DmViewer, userIds: string[]) {
    const ids = [...new Set([viewer.userId, ...userIds])];
    if (ids.length > DM_MEMBERS_MAX) {
      throw dmError('DM_FULL');
    }
    await this.requireWorkspaceMembers(viewer, ids);
    return this.dms.open(viewer, ids);
  }

  async addPeople(viewer: DmViewer, channelId: string, userIds: string[]) {
    await this.authorize(viewer, channelId, 'addDmPeople');
    const ids = [...new Set(userIds)];
    await this.requireWorkspaceMembers(viewer, ids);
    return this.dms.addPeople(viewer, channelId, ids);
  }

  async convertToChannel(viewer: DmViewer, channelId: string, name: string) {
    await this.authorize(viewer, channelId, 'convertDm');
    return this.dms.convertToChannel(viewer, channelId, name);
  }

  /** Anything that is not a DM the viewer is in is NOT_FOUND, so a DM never leaks to a non-member. */
  private async authorize(
    viewer: DmViewer,
    channelId: string,
    action: ChannelAction
  ) {
    const channel = await this.channels.find(viewer, channelId);
    if (
      !channel ||
      channel.kind !== 'dm' ||
      checkChannel('view', viewer.workspaceRole, channel)
    ) {
      throw dmError('NOT_FOUND');
    }
    if (checkChannel(action, viewer.workspaceRole, channel)) {
      throw dmError('FORBIDDEN');
    }
    return channel;
  }

  private async requireWorkspaceMembers(viewer: DmViewer, userIds: string[]) {
    const inWorkspace = await this.workspaceMembers.count(
      viewer.organizationId,
      userIds
    );
    if (inWorkspace !== userIds.length) {
      throw dmError('NOT_FOUND', 'That person is not in this workspace.');
    }
  }
}
