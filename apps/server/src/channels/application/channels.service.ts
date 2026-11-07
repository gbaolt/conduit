import {
  canCreateChannel,
  type Channel,
  type ChannelAction,
  type ChannelMember,
  checkChannel,
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
  async get(userId: string, channelId: string) {
    const organizationId = await this.channels.findOrganizationId(channelId);
    const workspaceRole =
      organizationId &&
      (await this.workspaceMembers.findRole(organizationId, userId));
    if (!organizationId || !workspaceRole) {
      throw channelError('NOT_FOUND');
    }
    return this.find({ userId, organizationId, workspaceRole }, channelId);
  }

  async create(
    viewer: ChannelViewer,
    input: { name: string; visibility: Channel['visibility'] }
  ) {
    const settings = await this.workspaceSettings.get(viewer.organizationId);
    if (!canCreateChannel(viewer.workspaceRole, input.visibility, settings)) {
      throw channelError('FORBIDDEN');
    }
    return this.channels.create(viewer, input);
  }

  async rename(viewer: ChannelViewer, channelId: string, name: string) {
    await this.authorize(viewer, channelId, 'rename');
    return this.channels.rename(viewer, channelId, name);
  }

  async delete(viewer: ChannelViewer, channelId: string) {
    await this.authorize(viewer, channelId, 'delete');
    await this.channels.delete(channelId);
  }

  async join(viewer: ChannelViewer, channelId: string) {
    const channel = await this.authorize(viewer, channelId, 'join');
    if (channel.membership) {
      return channel;
    }
    await this.channels.addMembers(channelId, [viewer.userId]);
    return this.find(viewer, channelId);
  }

  async leave(viewer: ChannelViewer, channelId: string) {
    await this.authorize(viewer, channelId, 'leave');
    await this.channels.removeMember(channelId, viewer.userId);
  }

  async archive(viewer: ChannelViewer, channelId: string) {
    await this.authorize(viewer, channelId, 'archive');
    return this.channels.setArchived(viewer, channelId, true);
  }

  async unarchive(viewer: ChannelViewer, channelId: string) {
    await this.authorize(viewer, channelId, 'unarchive');
    return this.channels.setArchived(viewer, channelId, false);
  }

  async setVisibility(
    viewer: ChannelViewer,
    channelId: string,
    visibility: Channel['visibility']
  ) {
    await this.authorize(
      viewer,
      channelId,
      visibility === 'private' ? 'makePrivate' : 'makePublic'
    );
    return this.channels.setVisibility(viewer, channelId, visibility);
  }

  async star(viewer: ChannelViewer, channelId: string) {
    await this.authorize(viewer, channelId, 'star');
    await this.channels.updateMembership(channelId, viewer.userId, {
      starredAt: new Date(),
    });
  }

  async unstar(viewer: ChannelViewer, channelId: string) {
    await this.authorize(viewer, channelId, 'star');
    await this.channels.updateMembership(channelId, viewer.userId, {
      starredAt: null,
    });
  }

  async moveToSection(
    viewer: ChannelViewer,
    channelId: string,
    sectionId: string | null
  ) {
    await this.authorize(viewer, channelId, 'moveToSection');
    // Another user's section is as good as missing.
    if (sectionId && !(await this.sections.exists(viewer, sectionId))) {
      throw sectionError('NOT_FOUND');
    }
    await this.channels.updateMembership(channelId, viewer.userId, {
      sectionId,
    });
  }

  async update(
    viewer: ChannelViewer,
    channelId: string,
    input: { topic?: string | null; description?: string | null }
  ) {
    await this.authorize(viewer, channelId, 'editDetails');
    // undefined leaves a column alone; null or empty clears it.
    const text = (value?: string | null) =>
      value === undefined ? undefined : value?.trim() || null;
    return this.channels.updateDetails(viewer, channelId, {
      topic: text(input.topic),
      description: text(input.description),
    });
  }

  async listMembers(
    viewer: ChannelViewer,
    channelId: string
  ): Promise<ChannelMember[]> {
    await this.find(viewer, channelId);
    return this.channels.listMembers(viewer, channelId);
  }

  async addMembers(
    viewer: ChannelViewer,
    channelId: string,
    userIds: string[]
  ) {
    await this.authorize(viewer, channelId, 'addMembers');
    const ids = [...new Set(userIds)];
    const inWorkspace = await this.workspaceMembers.count(
      viewer.organizationId,
      ids
    );
    if (inWorkspace !== ids.length) {
      throw channelError('NOT_FOUND', 'That person is not in this workspace.');
    }
    await this.channels.addMembers(channelId, ids);
  }

  async removeMember(viewer: ChannelViewer, channelId: string, userId: string) {
    await this.authorize(viewer, channelId, 'removeMember');
    if (userId === viewer.userId) {
      throw channelError('FORBIDDEN', 'Use Leave channel to remove yourself.');
    }
    if (!(await this.channels.removeMember(channelId, userId))) {
      throw channelError('NOT_FOUND', 'That person is not in this channel.');
    }
  }

  async setMemberRole(
    viewer: ChannelViewer,
    channelId: string,
    userId: string,
    role: ChannelMember['role']
  ) {
    await this.authorize(viewer, channelId, 'setManager');
    const current = await this.channels.findMemberRole(
      viewer,
      channelId,
      userId
    );
    if (!current) {
      throw channelError('NOT_FOUND', 'That person is not in this channel.');
    }
    await this.channels.setMemberRole(
      viewer,
      channelId,
      userId,
      role,
      role === 'member' && current === 'manager'
    );
  }

  /** A channel the viewer cannot see is NOT_FOUND, so private channels do not leak. */
  private async find(viewer: ChannelViewer, channelId: string) {
    const channel = await this.channels.find(viewer, channelId);
    if (!channel || checkChannel('view', viewer.workspaceRole, channel)) {
      throw channelError('NOT_FOUND');
    }
    return channel;
  }

  private async authorize(
    viewer: ChannelViewer,
    channelId: string,
    action: ChannelAction
  ) {
    const channel = await this.find(viewer, channelId);
    const denial = checkChannel(action, viewer.workspaceRole, channel);
    if (denial) {
      throw channelError(denial);
    }
    return channel;
  }
}
