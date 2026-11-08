import {
  canCreateChannel,
  type ChannelAction,
  checkChannel,
  type Room,
  type RoomMember,
  type WorkspaceRole,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { channelError, sectionError } from '@/channels/domain/channel-errors';
import { ChannelSectionsRepository } from '@/channels/domain/channel-sections.repository';
import { ChannelsRepository } from '@/channels/domain/channels.repository';
import { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';
import { WorkspaceSettingsRepository } from '@/workspaces/domain/workspace-settings.repository';

export type ChannelViewer = {
  userId: string;
  organizationId: string;
  workspaceRole: WorkspaceRole;
};

@Injectable()
export class ChannelsService {
  constructor(
    @Inject(ChannelsRepository) private readonly channels: ChannelsRepository,
    @Inject(ChannelSectionsRepository)
    private readonly sections: ChannelSectionsRepository,
    @Inject(WorkspaceMembersRepository)
    private readonly workspaceMembers: WorkspaceMembersRepository,
    @Inject(WorkspaceSettingsRepository)
    private readonly workspaceSettings: WorkspaceSettingsRepository
  ) {}

  /** Active channels, or only the archived ones when asked. */
  list(viewer: ChannelViewer, archived = false) {
    return this.channels.list(viewer, archived);
  }

  /** Resolves a channel in any workspace the caller belongs to, so a copied link can switch workspace. */
  async get(userId: string, roomId: string) {
    const organizationId = await this.channels.findOrganizationId(roomId);
    const workspaceRole =
      organizationId &&
      (await this.workspaceMembers.findRole(organizationId, userId));
    if (!organizationId || !workspaceRole) {
      throw channelError('NOT_FOUND');
    }
    return this.find({ userId, organizationId, workspaceRole }, roomId);
  }

  async create(
    viewer: ChannelViewer,
    input: { name: string; visibility: Room['visibility'] }
  ) {
    const settings = await this.workspaceSettings.get(viewer.organizationId);
    if (!canCreateChannel(viewer.workspaceRole, input.visibility, settings)) {
      throw channelError('FORBIDDEN');
    }
    return this.channels.create(viewer, input);
  }

  async rename(viewer: ChannelViewer, roomId: string, name: string) {
    await this.authorize(viewer, roomId, 'rename');
    return this.channels.rename(viewer, roomId, name);
  }

  async delete(viewer: ChannelViewer, roomId: string) {
    await this.authorize(viewer, roomId, 'delete');
    await this.channels.delete(roomId);
  }

  async join(viewer: ChannelViewer, roomId: string) {
    const channel = await this.authorize(viewer, roomId, 'join');
    if (channel.membership) {
      return channel;
    }
    await this.channels.addMembers(roomId, [viewer.userId]);
    return this.find(viewer, roomId);
  }

  async leave(viewer: ChannelViewer, roomId: string) {
    await this.authorize(viewer, roomId, 'leave');
    await this.channels.removeMember(roomId, viewer.userId);
  }

  async archive(viewer: ChannelViewer, roomId: string) {
    await this.authorize(viewer, roomId, 'archive');
    return this.channels.setArchived(viewer, roomId, true);
  }

  async unarchive(viewer: ChannelViewer, roomId: string) {
    await this.authorize(viewer, roomId, 'unarchive');
    return this.channels.setArchived(viewer, roomId, false);
  }

  async setVisibility(
    viewer: ChannelViewer,
    roomId: string,
    visibility: Room['visibility']
  ) {
    await this.authorize(
      viewer,
      roomId,
      visibility === 'private' ? 'makePrivate' : 'makePublic'
    );
    return this.channels.setVisibility(viewer, roomId, visibility);
  }

  async star(viewer: ChannelViewer, roomId: string) {
    await this.authorize(viewer, roomId, 'star');
    await this.channels.updateMembership(roomId, viewer.userId, {
      starredAt: new Date(),
    });
  }

  async unstar(viewer: ChannelViewer, roomId: string) {
    await this.authorize(viewer, roomId, 'star');
    await this.channels.updateMembership(roomId, viewer.userId, {
      starredAt: null,
    });
  }

  async moveToSection(
    viewer: ChannelViewer,
    roomId: string,
    sectionId: string | null
  ) {
    await this.authorize(viewer, roomId, 'moveToSection');
    // Another user's section is as good as missing.
    if (sectionId && !(await this.sections.exists(viewer, sectionId))) {
      throw sectionError('NOT_FOUND');
    }
    await this.channels.updateMembership(roomId, viewer.userId, {
      sectionId,
    });
  }

  async update(
    viewer: ChannelViewer,
    roomId: string,
    input: { topic?: string | null; description?: string | null }
  ) {
    await this.authorize(viewer, roomId, 'editDetails');
    // undefined leaves a column alone; null or empty clears it.
    const text = (value?: string | null) =>
      value === undefined ? undefined : value?.trim() || null;
    return this.channels.updateDetails(viewer, roomId, {
      topic: text(input.topic),
      description: text(input.description),
    });
  }

  async listMembers(
    viewer: ChannelViewer,
    roomId: string
  ): Promise<RoomMember[]> {
    await this.find(viewer, roomId);
    return this.channels.listMembers(viewer, roomId);
  }

  async addMembers(viewer: ChannelViewer, roomId: string, userIds: string[]) {
    await this.authorize(viewer, roomId, 'addMembers');
    const ids = [...new Set(userIds)];
    const inWorkspace = await this.workspaceMembers.count(
      viewer.organizationId,
      ids
    );
    if (inWorkspace !== ids.length) {
      throw channelError('NOT_FOUND', 'That person is not in this workspace.');
    }
    await this.channels.addMembers(roomId, ids);
  }

  async removeMember(viewer: ChannelViewer, roomId: string, userId: string) {
    await this.authorize(viewer, roomId, 'removeMember');
    if (userId === viewer.userId) {
      throw channelError('FORBIDDEN', 'Use Leave channel to remove yourself.');
    }
    if (!(await this.channels.removeMember(roomId, userId))) {
      throw channelError('NOT_FOUND', 'That person is not in this channel.');
    }
  }

  async setMemberRole(
    viewer: ChannelViewer,
    roomId: string,
    userId: string,
    role: RoomMember['role']
  ) {
    await this.authorize(viewer, roomId, 'setManager');
    const current = await this.channels.findMemberRole(viewer, roomId, userId);
    if (!current) {
      throw channelError('NOT_FOUND', 'That person is not in this channel.');
    }
    await this.channels.setMemberRole(
      viewer,
      roomId,
      userId,
      role,
      role === 'member' && current === 'manager'
    );
  }

  /** A channel the viewer cannot see is NOT_FOUND, so private channels do not leak. */
  private async find(viewer: ChannelViewer, roomId: string) {
    const channel = await this.channels.find(viewer, roomId);
    if (!channel || checkChannel('view', viewer.workspaceRole, channel)) {
      throw channelError('NOT_FOUND');
    }
    return channel;
  }

  private async authorize(
    viewer: ChannelViewer,
    roomId: string,
    action: ChannelAction
  ) {
    const channel = await this.find(viewer, roomId);
    const denial = checkChannel(action, viewer.workspaceRole, channel);
    if (denial) {
      throw channelError(denial);
    }
    return channel;
  }
}
