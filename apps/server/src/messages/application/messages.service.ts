import {
  addReaction,
  type Channel,
  type ChannelAction,
  checkChannel,
  type Message,
  MESSAGE_PAGE_DEFAULT,
  parseMentions,
  removeReaction,
  SAVED_MESSAGES_MAX,
  SUMMARY_MESSAGES_MAX,
  type WorkspaceRole,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { ChannelsRepository } from '@/channels/domain/channels.repository';
import { DmsRepository } from '@/channels/domain/dms.repository';
import { messageError } from '@/messages/domain/message-errors';
import { MessagesRepository } from '@/messages/domain/messages.repository';
import { SavedMessagesRepository } from '@/messages/domain/saved-messages.repository';

export type MessageViewer = {
  userId: string;
  organizationId: string;
  workspaceRole: WorkspaceRole;
};

@Injectable()
export class MessagesService {
  constructor(
    @Inject(MessagesRepository) private readonly messages: MessagesRepository,
    @Inject(ChannelsRepository) private readonly channels: ChannelsRepository,
    @Inject(SavedMessagesRepository)
    private readonly saved: SavedMessagesRepository,
    @Inject(DmsRepository) private readonly dms: DmsRepository
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

  /** A message with its channel, or its thread's root and replies. */
  async get(viewer: MessageViewer, messageId: string) {
    const message = await this.messages.find(messageId);
    if (!message) {
      throw messageError('NOT_FOUND');
    }
    await this.find(viewer, message.channelId);
    return message;
  }

  /** A deleted root still lists its replies. */
  async listReplies(
    viewer: MessageViewer,
    input: { messageId: string; before?: string; limit?: number }
  ) {
    const root = await this.get(viewer, input.messageId);
    if (root.parentId) {
      throw messageError('NOT_FOUND');
    }
    const page = await this.messages.listReplies(root.channelId, root.id, {
      before: input.before,
      limit: input.limit ?? MESSAGE_PAGE_DEFAULT,
    });
    if (!page) {
      throw messageError('NOT_FOUND');
    }
    return page;
  }

  /**
   * What a summary reads: the channel's log, or one thread, behind the same view check as `list`.
   * A viewer who cannot read the channel gets NOT_FOUND.
   */
  async listForSummary(
    viewer: MessageViewer,
    input: { channelId: string; threadId?: string; from?: Date; to?: Date }
  ) {
    await this.find(viewer, input.channelId);
    return this.messages.listForSummary(input.channelId, {
      threadId: input.threadId,
      from: input.from,
      to: input.to,
      limit: SUMMARY_MESSAGES_MAX,
    });
  }

  async send(
    viewer: MessageViewer,
    input: {
      channelId: string;
      clientId: string;
      body: string;
      parentId?: string;
      alsoSentToChannel?: boolean;
    }
  ) {
    const channel = await this.find(viewer, input.channelId);
    this.authorize(viewer, channel, 'post');

    if (input.parentId) {
      const root = await this.messages.find(input.parentId);
      if (!root || root.channelId !== channel.id || root.deletedAt) {
        throw messageError('NOT_FOUND');
      }
      if (root.parentId) {
        throw messageError('REPLY_TO_REPLY');
      }
    }

    const body = input.body.trim();
    return this.messages.send({
      channelId: channel.id,
      authorId: viewer.userId,
      clientId: input.clientId,
      body,
      mentions: await this.mentionsIn(viewer, channel.id, body),
      parentId: input.parentId,
      alsoSentToChannel: Boolean(input.parentId && input.alsoSentToChannel),
    });
  }

  async edit(viewer: MessageViewer, messageId: string, body: string) {
    const { message, channel } = await this.findLive(viewer, messageId);
    if (message.authorId !== viewer.userId) {
      throw messageError('FORBIDDEN', 'Only the author can edit a message.');
    }
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

  async react(viewer: MessageViewer, messageId: string, emoji: string) {
    const { message, channel } = await this.findLive(viewer, messageId);
    this.authorize(viewer, channel, 'post');

    const updated = await this.messages.updateReactions(message.id, (current) =>
      addReaction(current, emoji, viewer.userId)
    );
    if (!updated) {
      throw messageError('REACTION_LIMIT');
    }
    return updated;
  }

  async unreact(viewer: MessageViewer, messageId: string, emoji: string) {
    const { message, channel } = await this.findLive(viewer, messageId);
    this.authorize(viewer, channel, 'post');

    const updated = await this.messages.updateReactions(message.id, (current) =>
      removeReaction(current, emoji, viewer.userId)
    );
    return updated ?? message;
  }

  /** Any member who can post can pin or unpin. Pinning a pinned message keeps its first pin. */
  async pin(viewer: MessageViewer, messageId: string) {
    const { message, channel } = await this.findLive(viewer, messageId);
    this.authorize(viewer, channel, 'post');
    return message.pinnedAt
      ? message
      : this.messages.setPinned(message.id, viewer.userId);
  }

  async unpin(viewer: MessageViewer, messageId: string) {
    const { message, channel } = await this.findLive(viewer, messageId);
    this.authorize(viewer, channel, 'post');
    return message.pinnedAt
      ? this.messages.setPinned(message.id, null)
      : message;
  }

  /** Only the author removes a preview from their message. */
  async removeLinkPreview(viewer: MessageViewer, messageId: string) {
    const { message, channel } = await this.findLive(viewer, messageId);
    if (message.authorId !== viewer.userId) {
      throw messageError('FORBIDDEN', 'Only the author can remove a preview.');
    }
    this.authorize(viewer, channel, 'post');

    if (!message.linkPreview) return message;
    return (await this.messages.setLinkPreview(message.id, null)) ?? message;
  }

  async listPinned(viewer: MessageViewer, channelId: string) {
    await this.find(viewer, channelId);
    return this.messages.listPinned(channelId);
  }

  /** Saving needs only read access, so an archived channel's messages can be saved. */
  async save(viewer: MessageViewer, messageId: string) {
    await this.findLive(viewer, messageId);
    await this.saved.add(viewer.userId, messageId);
  }

  async unsave(viewer: MessageViewer, messageId: string) {
    await this.saved.remove(viewer.userId, messageId);
  }

  /** Only messages in conversations the viewer can still read, so leaving a private channel hides its saves. */
  async listSaved(viewer: MessageViewer) {
    const [active, archived, dms] = await Promise.all([
      this.channels.list(viewer, false),
      this.channels.list(viewer, true),
      this.dms.list(viewer),
    ]);
    return this.saved.list(
      viewer.userId,
      [...active, ...archived, ...dms].map((conversation) => conversation.id),
      SAVED_MESSAGES_MAX
    );
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
  async find(viewer: MessageViewer, channelId: string) {
    const channel = await this.channels.find(viewer, channelId);
    if (!channel || checkChannel('view', viewer.workspaceRole, channel)) {
      throw messageError('NOT_FOUND', 'Channel not found.');
    }
    return channel;
  }

  private async findLive(
    viewer: MessageViewer,
    messageId: string
  ): Promise<{ message: Message; channel: Channel }> {
    const message = await this.messages.find(messageId);
    if (!message || message.deletedAt) {
      throw messageError('NOT_FOUND');
    }
    return { message, channel: await this.find(viewer, message.channelId) };
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
