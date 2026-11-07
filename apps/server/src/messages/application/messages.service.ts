import {
  type Channel,
  type ChannelAction,
  checkChannel,
  type Message,
  MESSAGE_PAGE_DEFAULT,
  parseMentions,
  type WorkspaceRole,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { ChannelsRepository } from '@/channels/domain/channels.repository';
import { messageError } from '@/messages/domain/message-errors';
import { MessagesRepository } from '@/messages/domain/messages.repository';

export type MessageViewer = {
  userId: string;
  organizationId: string;
  workspaceRole: WorkspaceRole;
};

@Injectable()
export class MessagesService {
  constructor(
    @Inject(MessagesRepository) private readonly messages: MessagesRepository,
    @Inject(ChannelsRepository) private readonly channels: ChannelsRepository
  ) {}

  async list(
    viewer: MessageViewer,
    input: { channelId: string; before?: string; limit?: number }
  ) {
    await this.find(viewer, input.channelId);
    const page = await this.messages.list(input.channelId, {
      before: input.before,
      limit: input.limit ?? MESSAGE_PAGE_DEFAULT,
    });
    if (!page) {
      throw messageError('NOT_FOUND');
    }
    return page;
  }

  async send(
    viewer: MessageViewer,
    input: { channelId: string; clientId: string; body: string }
  ) {
    const channel = await this.find(viewer, input.channelId);
    this.authorize(viewer, channel, 'post');

    const body = input.body.trim();
    return this.messages.send({
      channelId: channel.id,
      authorId: viewer.userId,
      clientId: input.clientId,
      body,
      mentions: await this.mentionsIn(viewer, channel.id, body),
    });
  }

  async edit(viewer: MessageViewer, messageId: string, body: string) {
    const message = await this.findLive(viewer, messageId);
    if (message.authorId !== viewer.userId) {
      throw messageError('FORBIDDEN', 'Only the author can edit a message.');
    }
    const channel = await this.find(viewer, message.channelId);
    this.authorize(viewer, channel, 'post');

    const trimmed = body.trim();
    return this.messages.edit(
      message.id,
      trimmed,
      await this.mentionsIn(viewer, channel.id, trimmed)
    );
  }

  async delete(viewer: MessageViewer, messageId: string) {
    const message = await this.messages.find(messageId);
    if (!message) {
      throw messageError('NOT_FOUND');
    }
    const channel = await this.find(viewer, message.channelId);
    if (message.deletedAt) {
      return;
    }
    this.authorize(
      viewer,
      channel,
      message.authorId === viewer.userId ? 'post' : 'deleteOthersMessages'
    );
    await this.messages.markDeleted(message.id);
  }

  /** The body's mentions, with a user mention kept only for a member of the channel. */
  private async mentionsIn(
    viewer: MessageViewer,
    channelId: string,
    body: string
  ) {
    const { userIds, channel, here } = parseMentions(body);
    if (userIds.length === 0) {
      return { userIds, channel, here };
    }
    const members = await this.channels.listMembers(viewer, channelId);
    const inChannel = new Set(members.map((member) => member.userId));
    return {
      userIds: userIds.filter((id) => inChannel.has(id)),
      channel,
      here,
    };
  }

  /** A channel the viewer cannot see is NOT_FOUND, so private channels do not leak. */
  private async find(viewer: MessageViewer, channelId: string) {
    const channel = await this.channels.find(viewer, channelId);
    if (!channel || checkChannel('view', viewer.workspaceRole, channel)) {
      throw messageError('NOT_FOUND', 'Channel not found.');
    }
    return channel;
  }

  private async findLive(
    viewer: MessageViewer,
    messageId: string
  ): Promise<Message> {
    const message = await this.messages.find(messageId);
    if (!message || message.deletedAt) {
      throw messageError('NOT_FOUND');
    }
    await this.find(viewer, message.channelId);
    return message;
  }

  private authorize(
    viewer: MessageViewer,
    channel: Channel,
    action: ChannelAction
  ) {
    const denial = checkChannel(action, viewer.workspaceRole, channel);
    if (denial === 'CHANNEL_ARCHIVED') {
      throw messageError('CHANNEL_ARCHIVED');
    }
    if (denial) {
      throw messageError('FORBIDDEN');
    }
  }
}
