import {
  canCreateChannel,
  type ChannelAction,
  checkChannel,
  type Room,
  type RoomMember,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { channelError, sectionError } from '@/channels/domain/channel-errors';
import { ChannelSectionsRepository } from '@/channels/domain/channel-sections.repository';
import {
  RoomsService,
  type RoomViewer,
} from '@/rooms/application/rooms.service';
import { RoomsRepository } from '@/rooms/domain/rooms.repository';
import { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';
import { WorkspaceSettingsRepository } from '@/workspaces/domain/workspace-settings.repository';

@Injectable()
export class ChannelsService {
  constructor(
    @Inject(RoomsRepository) private readonly channels: RoomsRepository,
    @Inject(ChannelSectionsRepository)
    private readonly sections: ChannelSectionsRepository,
    @Inject(WorkspaceMembersRepository)
    private readonly workspaceMembers: WorkspaceMembersRepository,
    @Inject(WorkspaceSettingsRepository)
    private readonly workspaceSettings: WorkspaceSettingsRepository,
    @Inject(RoomsService) private readonly rooms: RoomsService
  ) {}

  /** Active channels, or only the archived ones when asked. */
  list(viewer: RoomViewer, archived = false) {
    return this.channels.list(viewer, archived);
  }

  async create(
    viewer: RoomViewer,
    input: { name: string; visibility: Room['visibility'] }
  ) {
    const settings = await this.workspaceSettings.get(viewer.organizationId);
    if (!canCreateChannel(viewer.workspaceRole, input.visibility, settings)) {
      throw channelError('FORBIDDEN');
    }
    return this.channels.create(viewer, input);
  }

  async rename(viewer: RoomViewer, roomId: string, name: string) {
    await this.authorize(viewer, roomId, 'rename');
    return this.channels.rename(viewer, roomId, name);
  }

  async delete(viewer: RoomViewer, roomId: string) {
    await this.authorize(viewer, roomId, 'delete');
    await this.channels.delete(roomId);
  }

  async join(viewer: RoomViewer, roomId: string) {
    const channel = await this.authorize(viewer, roomId, 'join');
    if (channel.membership) {
      return channel;
    }
    await this.channels.addMembers(roomId, [viewer.userId]);
    return this.rooms.find(viewer, roomId);
  }

  async leave(viewer: RoomViewer, roomId: string) {
    await this.authorize(viewer, roomId, 'leave');
    await this.channels.removeMember(roomId, viewer.userId);
  }

  async archive(viewer: RoomViewer, roomId: string) {
    await this.authorize(viewer, roomId, 'archive');
    return this.channels.setArchived(viewer, roomId, true);
  }

  async unarchive(viewer: RoomViewer, roomId: string) {
    await this.authorize(viewer, roomId, 'unarchive');
    return this.channels.setArchived(viewer, roomId, false);
  }

  async setVisibility(
    viewer: RoomViewer,
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

  async star(viewer: RoomViewer, roomId: string) {
    await this.authorize(viewer, roomId, 'star');
    await this.channels.updateMembership(roomId, viewer.userId, {
      starredAt: new Date(),
    });
  }

  async unstar(viewer: RoomViewer, roomId: string) {
    await this.authorize(viewer, roomId, 'star');
    await this.channels.updateMembership(roomId, viewer.userId, {
      starredAt: null,
    });
  }

  async moveToSection(
    viewer: RoomViewer,
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
    viewer: RoomViewer,
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

  async addMembers(viewer: RoomViewer, roomId: string, userIds: string[]) {
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

  async removeMember(viewer: RoomViewer, roomId: string, userId: string) {
    await this.authorize(viewer, roomId, 'removeMember');
    if (userId === viewer.userId) {
      throw channelError('FORBIDDEN', 'Use Leave channel to remove yourself.');
    }
    if (!(await this.channels.removeMember(roomId, userId))) {
      throw channelError('NOT_FOUND', 'That person is not in this channel.');
    }
  }

  async setMemberRole(
    viewer: RoomViewer,
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

  private async authorize(
    viewer: RoomViewer,
    roomId: string,
    action: ChannelAction
  ) {
    const channel = await this.rooms.find(viewer, roomId);
    const denial = checkChannel(action, viewer.workspaceRole, channel);
    if (denial) {
      throw channelError(denial);
    }
    return channel;
  }
}
