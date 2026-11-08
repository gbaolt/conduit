import {
  type ChannelAction,
  checkChannel,
  TYPING_TTL_MS,
  type WorkspaceRole,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { ActivityRepository } from '@/activity/domain/activity.repository';
import { activityError } from '@/activity/domain/activity-errors';
import { RoomsRepository } from '@/rooms/domain/rooms.repository';

export type ActivityViewer = {
  userId: string;
  organizationId: string;
  workspaceRole: WorkspaceRole;
};

type ConversationKey = { roomId: string; parentId?: string };

@Injectable()
export class ActivityService {
  constructor(
    @Inject(ActivityRepository) private readonly activity: ActivityRepository,
    @Inject(RoomsRepository) private readonly channels: RoomsRepository
  ) {}

  async markRead(
    viewer: ActivityViewer,
    input: { roomId: string; messageId: string }
  ) {
    await this.authorize(viewer, input.roomId, 'view');
    const found = await this.activity.markRead({
      roomId: input.roomId,
      userId: viewer.userId,
      messageId: input.messageId,
    });
    if (!found) {
      throw activityError('NOT_FOUND', 'Message not found.');
    }
  }

  async getDraft(viewer: ActivityViewer, key: ConversationKey) {
    await this.authorize(viewer, key.roomId, 'view');
    return { body: await this.activity.getDraft(this.scope(viewer, key)) };
  }

  async saveDraft(viewer: ActivityViewer, key: ConversationKey, body: string) {
    await this.authorize(viewer, key.roomId, 'post');
    await this.activity.saveDraft(this.scope(viewer, key), body);
  }

  async ping(viewer: ActivityViewer, key: ConversationKey) {
    await this.authorize(viewer, key.roomId, 'post');
    await this.activity.setTyping(
      this.scope(viewer, key),
      new Date(Date.now() + TYPING_TTL_MS)
    );
  }

  async heartbeat(viewer: ActivityViewer, away: boolean) {
    await this.activity.recordHeartbeat({
      organizationId: viewer.organizationId,
      userId: viewer.userId,
      away,
      at: new Date(),
    });
  }

  private scope(viewer: ActivityViewer, key: ConversationKey) {
    return {
      roomId: key.roomId,
      userId: viewer.userId,
      parentId: key.parentId ?? '',
    };
  }

  /** A channel the viewer cannot see is NOT_FOUND, so private channels do not leak. */
  private async authorize(
    viewer: ActivityViewer,
    roomId: string,
    action: ChannelAction
  ) {
    const channel = await this.channels.find(viewer, roomId);
    if (!channel || checkChannel('view', viewer.workspaceRole, channel)) {
      throw activityError('NOT_FOUND');
    }
    const denial = checkChannel(action, viewer.workspaceRole, channel);
    if (denial === 'CHANNEL_ARCHIVED') {
      throw activityError('CHANNEL_ARCHIVED');
    }
    if (denial) {
      throw activityError('FORBIDDEN');
    }
  }
}
