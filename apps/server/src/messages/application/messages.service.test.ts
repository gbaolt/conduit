import type { Channel, ChannelMember, Message } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import type { ChannelsRepository } from '@/channels/domain/channels.repository';
import type { MessagesRepository } from '@/messages/domain/messages.repository';

import { MessagesService, type MessageViewer } from './messages.service';

const organizationId = 'org';
const viewerOf = (
  userId: string,
  workspaceRole: MessageViewer['workspaceRole'] = 'member'
): MessageViewer => ({ userId, organizationId, workspaceRole });

const author = viewerOf('author');
const other = viewerOf('other');
const outsider = viewerOf('outsider');
const admin = viewerOf('admin', 'admin');

function channelFor(
  role: 'manager' | 'member' | null,
  overrides: Partial<Channel> = {}
): Channel {
  return {
    id: 'c1',
    organizationId,
    name: 'design',
    topic: null,
    description: null,
    visibility: 'public',
    isDefault: false,
    archivedAt: null,
    memberCount: 2,
    createdById: null,
    createdAt: new Date(0),
    membership: role && { role, starredAt: null, sectionId: null },
    archivedByName: null,
    ...overrides,
  };
}

/** Each viewer's own view of the channel, as `ChannelsRepository.find` returns it. */
function setup(
  views: Record<string, Channel | null>,
  memberIds: string[] = []
) {
  const stored = new Map<string, Message>();
  const sent: Parameters<MessagesRepository['send']>[0][] = [];

  const messages = {
    find: async (id: string) => stored.get(id) ?? null,
    send: async (input) => {
      sent.push(input);
      const message = {
        id: `m${stored.size + 1}`,
        channelId: input.channelId,
        authorId: input.authorId,
        clientId: input.clientId,
        body: input.body,
        mentionedUserIds: input.mentions.userIds,
        deletedAt: null,
      } as Message;
      stored.set(message.id, message);
      return { message, txid: '1' };
    },
    edit: async (id, body) => {
      const message = { ...stored.get(id)!, body, editedAt: new Date() };
      stored.set(id, message);
      return message;
    },
    markDeleted: async (id) => {
      stored.set(id, { ...stored.get(id)!, body: '', deletedAt: new Date() });
    },
  } as Partial<MessagesRepository> as MessagesRepository;

  const channels = {
    find: async (scope: { userId: string }) => views[scope.userId] ?? null,
    listMembers: async () =>
      memberIds.map(
        (userId): ChannelMember => ({
          userId,
          name: userId,
          image: null,
          role: 'member',
          joinedAt: new Date(0),
        })
      ),
  } as Partial<ChannelsRepository> as ChannelsRepository;

  return { service: new MessagesService(messages, channels), stored, sent };
}

const sendAs = (
  service: MessagesService,
  viewer: MessageViewer,
  body = 'hello'
) => service.send(viewer, { channelId: 'c1', clientId: 'k1', body });

describe('MessagesService.send', () => {
  it('stores the trimmed body for a channel member', async () => {
    const { service, sent } = setup({ author: channelFor('member') });

    await sendAs(service, author, '  hello  \n');

    expect(sent[0]).toMatchObject({ authorId: 'author', body: 'hello' });
  });

  it('refuses a send to an archived channel', async () => {
    const { service } = setup({
      author: channelFor('member', { archivedAt: new Date() }),
    });

    await expect(sendAs(service, author)).rejects.toMatchObject({
      code: 'CHANNEL_ARCHIVED',
    });
  });

  it('refuses someone who can read a public channel but has not joined', async () => {
    const { service } = setup({ outsider: channelFor(null) });

    await expect(sendAs(service, outsider)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('hides a private channel from someone outside it', async () => {
    const { service } = setup({
      outsider: channelFor(null, { visibility: 'private' }),
    });

    await expect(sendAs(service, outsider)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('keeps a user mention only for a member of the channel', async () => {
    const { service, sent } = setup({ author: channelFor('member') }, ['linh']);

    await sendAs(service, author, '<@linh> <@ghost> <@here>');

    expect(sent[0]?.mentions).toEqual({
      userIds: ['linh'],
      channel: false,
      here: true,
    });
  });
});

describe('MessagesService.edit', () => {
  const views = { author: channelFor('member'), other: channelFor('manager') };

  it('lets the author edit', async () => {
    const { service } = setup(views);
    const { message } = await sendAs(service, author);

    await expect(
      service.edit(author, message.id, 'changed')
    ).resolves.toMatchObject({ body: 'changed' });
  });

  it('refuses everyone else, a channel manager included', async () => {
    const { service } = setup(views);
    const { message } = await sendAs(service, author);

    await expect(
      service.edit(other, message.id, 'changed')
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses to edit a deleted message', async () => {
    const { service } = setup(views);
    const { message } = await sendAs(service, author);
    await service.delete(author, message.id);

    await expect(
      service.edit(author, message.id, 'changed')
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('MessagesService.delete', () => {
  it('lets the author delete', async () => {
    const { service, stored } = setup({ author: channelFor('member') });
    const { message } = await sendAs(service, author);

    await service.delete(author, message.id);

    expect(stored.get(message.id)).toMatchObject({ body: '' });
  });

  it('lets a channel manager delete a message from someone else', async () => {
    const { service, stored } = setup({
      author: channelFor('member'),
      other: channelFor('manager'),
    });
    const { message } = await sendAs(service, author);

    await service.delete(other, message.id);

    expect(stored.get(message.id)?.deletedAt).toBeInstanceOf(Date);
  });

  it('lets a workspace admin delete a message from someone else', async () => {
    const { service, stored } = setup({
      author: channelFor('member'),
      admin: channelFor(null),
    });
    const { message } = await sendAs(service, author);

    await service.delete(admin, message.id);

    expect(stored.get(message.id)?.deletedAt).toBeInstanceOf(Date);
  });

  it('refuses a plain member deleting a message from someone else', async () => {
    const { service } = setup({
      author: channelFor('member'),
      other: channelFor('member'),
    });
    const { message } = await sendAs(service, author);

    await expect(service.delete(other, message.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('does nothing when the message is already deleted', async () => {
    const { service } = setup({ author: channelFor('member') });
    const { message } = await sendAs(service, author);
    await service.delete(author, message.id);

    await expect(service.delete(author, message.id)).resolves.toBeUndefined();
  });
});
