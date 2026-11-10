import {
  type Dm,
  type Message,
  REACTION_EMOJI_MAX,
  type Room,
  type RoomMember,
  type SavedMessage,
} from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import type { DmsRepository } from '@/dms/domain/dms.repository';
import type { MessagesRepository } from '@/messages/domain/messages.repository';
import type { SavedMessagesRepository } from '@/messages/domain/saved-messages.repository';
import type { RoomsRepository } from '@/rooms/domain/rooms.repository';

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
  overrides: Partial<Room> = {}
): Room {
  return {
    id: 'c1',
    organizationId,
    kind: 'channel',
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
function setup(views: Record<string, Room | null>, memberIds: string[] = []) {
  const stored = new Map<string, Message>();
  const sent: Parameters<MessagesRepository['send']>[0][] = [];

  const messages = {
    find: async (id: string) => stored.get(id) ?? null,
    send: async (input) => {
      sent.push(input);
      const message = {
        id: `m${stored.size + 1}`,
        roomId: input.roomId,
        authorId: input.authorId,
        clientId: input.clientId,
        parentId: input.parentId ?? null,
        alsoSentToChannel: input.alsoSentToChannel ?? false,
        body: input.body,
        mentionedUserIds: input.mentions.userIds,
        reactions: {},
        pinnedAt: null,
        pinnedById: null,
        deletedAt: null,
      } as unknown as Message;
      stored.set(message.id, message);
      return { message, txid: '1' };
    },
    listReplies: async (_channelId, parentId, page) => {
      const replies = [...stored.values()].filter(
        (message) => message.parentId === parentId
      );
      return {
        messages: replies.slice(0, page.limit),
        hasMore: replies.length > page.limit,
      };
    },
    edit: async (id, body) => {
      const message = { ...stored.get(id)!, body, editedAt: new Date() };
      stored.set(id, message);
      return message;
    },
    markDeleted: async (id) => {
      stored.set(id, { ...stored.get(id)!, body: '', deletedAt: new Date() });
    },
    updateReactions: async (id, update) => {
      const message = stored.get(id)!;
      const reactions = update(message.reactions);
      if (!reactions) return null;
      const next = { ...message, reactions };
      stored.set(id, next);
      return next;
    },
    setLinkPreview: async (id, linkPreview) => {
      const next = { ...stored.get(id)!, linkPreview };
      stored.set(id, next);
      return next;
    },
    setPinned: async (id, pinnedById) => {
      const next = {
        ...stored.get(id)!,
        pinnedAt: pinnedById ? new Date() : null,
        pinnedById,
      };
      stored.set(id, next);
      return next;
    },
  } as Partial<MessagesRepository> as MessagesRepository;

  const bookmarks = new Map<string, Set<string>>();
  const saved = {
    add: async (userId, messageId) => {
      bookmarks.set(
        userId,
        (bookmarks.get(userId) ?? new Set()).add(messageId)
      );
    },
    remove: async (userId, messageId) => {
      bookmarks.get(userId)?.delete(messageId);
    },
    list: async (userId, roomIds): Promise<SavedMessage[]> =>
      [...(bookmarks.get(userId) ?? [])]
        .map((id) => stored.get(id)!)
        .filter((message) => roomIds.includes(message.roomId))
        .map((message) => ({
          message,
          channelName: 'design',
          savedAt: new Date(0),
        })),
  } as Partial<SavedMessagesRepository> as SavedMessagesRepository;

  const channels = {
    find: async (scope: { userId: string }) => views[scope.userId] ?? null,
    list: async (scope: { userId: string }, archived: boolean) => {
      const view = views[scope.userId];
      // The real list leaves DMs out.
      return view?.kind === 'channel' && Boolean(view.archivedAt) === archived
        ? [view]
        : [];
    },
    listMembers: async () =>
      memberIds.map(
        (userId): RoomMember => ({
          userId,
          name: userId,
          email: `${userId}@example.com`,
          image: null,
          role: 'member',
          joinedAt: new Date(0),
        })
      ),
  } as Partial<RoomsRepository> as RoomsRepository;

  const dmIds: string[] = [];
  const dms = {
    list: async () => dmIds.map((id) => ({ id }) as Dm),
  } as Partial<DmsRepository> as DmsRepository;

  return {
    dmIds,
    service: new MessagesService(messages, channels, saved, dms),
    stored,
    sent,
  };
}

const sendAs = (
  service: MessagesService,
  viewer: MessageViewer,
  body = 'hello'
) => service.send(viewer, { roomId: 'c1', clientId: 'k1', body });

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

describe('MessagesService threads', () => {
  const views = { author: channelFor('member'), other: channelFor('member') };
  const reply = (
    service: MessagesService,
    viewer: MessageViewer,
    parentId: string,
    extra: { alsoSentToChannel?: boolean } = {}
  ) =>
    service.send(viewer, {
      roomId: 'c1',
      clientId: crypto.randomUUID(),
      body: 'reply',
      parentId,
      alsoSentToChannel: extra.alsoSentToChannel,
    });

  it('stores a reply under its root', async () => {
    const { service, sent } = setup(views);
    const { message: root } = await sendAs(service, author);

    await reply(service, other, root.id);

    expect(sent[1]).toMatchObject({
      parentId: root.id,
      alsoSentToChannel: false,
    });
  });

  it('passes also-send-to-channel through for a reply and drops it without a parent', async () => {
    const { service, sent } = setup(views);
    const { message: root } = await sendAs(service, author);

    await reply(service, other, root.id, { alsoSentToChannel: true });
    await service.send(other, {
      roomId: 'c1',
      clientId: 'plain',
      body: 'hi',
      alsoSentToChannel: true,
    });

    expect(sent[1]?.alsoSentToChannel).toBe(true);
    expect(sent[2]?.alsoSentToChannel).toBe(false);
  });

  it('refuses a reply to a reply', async () => {
    const { service } = setup(views);
    const { message: root } = await sendAs(service, author);
    const { message: first } = await reply(service, other, root.id);

    await expect(reply(service, author, first.id)).rejects.toMatchObject({
      code: 'REPLY_TO_REPLY',
    });
  });

  it('refuses a reply to a deleted or missing root', async () => {
    const { service } = setup(views);
    const { message: root } = await sendAs(service, author);
    await service.delete(author, root.id);

    await expect(reply(service, other, root.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(reply(service, other, 'ghost')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('refuses a root that belongs to another channel', async () => {
    const { service, stored } = setup(views);
    const { message: root } = await sendAs(service, author);
    stored.set(root.id, { ...root, roomId: 'c2' });

    await expect(reply(service, other, root.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('refuses a reply from someone who cannot post in the channel', async () => {
    const { service } = setup({ ...views, outsider: channelFor(null) });
    const { message: root } = await sendAs(service, author);

    await expect(reply(service, outsider, root.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('lists the replies of a root, even a deleted one', async () => {
    const { service } = setup(views);
    const { message: root } = await sendAs(service, author);
    await reply(service, other, root.id);
    await service.delete(author, root.id);

    const page = await service.listReplies(other, { messageId: root.id });

    expect(page.messages).toHaveLength(1);
  });

  it('lists nothing for a reply, and hides a private channel from an outsider', async () => {
    const { service } = setup({
      author: channelFor('member', { visibility: 'private' }),
      other: channelFor('member', { visibility: 'private' }),
      outsider: channelFor(null, { visibility: 'private' }),
    });
    const { message: root } = await sendAs(service, author);
    const { message: first } = await reply(service, other, root.id);

    await expect(
      service.listReplies(other, { messageId: first.id })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service.listReplies(outsider, { messageId: root.id })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.get(outsider, root.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('MessagesService in a DM', () => {
  const dm = (role: 'member' | null, overrides: Partial<Room> = {}) =>
    channelFor(role, { kind: 'dm', visibility: 'private', ...overrides });

  it('lets a DM member send, and reply in a thread', async () => {
    const { service, sent } = setup({ author: dm('member') });
    const { message: root } = await sendAs(service, author);

    await service.send(author, {
      roomId: 'c1',
      clientId: 'r1',
      body: 'reply',
      parentId: root.id,
    });

    expect(sent[1]).toMatchObject({ parentId: root.id });
  });

  it('hides a DM from everyone outside it, an admin included', async () => {
    const { service } = setup({
      author: dm('member'),
      admin: dm(null),
      outsider: dm(null),
    });
    const { message } = await sendAs(service, author);

    for (const viewer of [admin, outsider]) {
      await expect(sendAs(service, viewer)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(service.get(viewer, message.id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(
        service.list(viewer, { roomId: 'c1' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(
        service.listReplies(viewer, { messageId: message.id })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(
        service.react(viewer, message.id, '👍')
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(service.save(viewer, message.id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    }
  });

  it("refuses to delete someone else's message, even for a workspace admin in the DM", async () => {
    const { service } = setup({ author: dm('member'), admin: dm('member') });
    const { message } = await sendAs(service, author);

    await expect(service.delete(admin, message.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(service.delete(author, message.id)).resolves.toBeUndefined();
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

describe('MessagesService reactions', () => {
  const views = { author: channelFor('member'), other: channelFor('member') };

  it('adds and removes a reaction', async () => {
    const { service } = setup(views);
    const { message } = await sendAs(service, author);

    const reacted = await service.react(other, message.id, '👍');
    expect(reacted.reactions).toEqual({ '👍': ['other'] });

    const removed = await service.unreact(other, message.id, '👍');
    expect(removed.reactions).toEqual({});
  });

  it('refuses a new emoji past the cap with REACTION_LIMIT', async () => {
    const { service, stored } = setup(views);
    const { message } = await sendAs(service, author);
    stored.set(message.id, {
      ...message,
      reactions: Object.fromEntries(
        Array.from({ length: REACTION_EMOJI_MAX }, (_, i) => [`e${i}`, ['x']])
      ),
    });

    await expect(service.react(other, message.id, '🎉')).rejects.toMatchObject({
      code: 'REACTION_LIMIT',
    });
  });

  it('refuses someone who has not joined the channel', async () => {
    const { service } = setup({ ...views, outsider: channelFor(null) });
    const { message } = await sendAs(service, author);

    await expect(
      service.react(outsider, message.id, '👍')
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses a reaction in an archived channel', async () => {
    const { service } = setup({
      ...views,
      other: channelFor('member', { archivedAt: new Date() }),
    });
    const { message } = await sendAs(service, author);

    await expect(service.react(other, message.id, '👍')).rejects.toMatchObject({
      code: 'CHANNEL_ARCHIVED',
    });
  });
});

describe('MessagesService pins', () => {
  const views = { author: channelFor('member'), other: channelFor('member') };

  it('lets any member who can post pin and unpin', async () => {
    const { service } = setup(views);
    const { message } = await sendAs(service, author);

    const pinned = await service.pin(other, message.id);
    expect(pinned).toMatchObject({ pinnedById: 'other' });
    expect(pinned.pinnedAt).toBeInstanceOf(Date);

    await expect(service.unpin(author, message.id)).resolves.toMatchObject({
      pinnedAt: null,
      pinnedById: null,
    });
  });

  it('keeps the first pin when a pinned message is pinned again', async () => {
    const { service } = setup(views);
    const { message } = await sendAs(service, author);
    const first = await service.pin(author, message.id);

    const again = await service.pin(other, message.id);

    expect(again.pinnedById).toBe('author');
    expect(again.pinnedAt).toEqual(first.pinnedAt);
  });

  it('refuses someone who has not joined the channel', async () => {
    const { service } = setup({ ...views, outsider: channelFor(null) });
    const { message } = await sendAs(service, author);

    await expect(service.pin(outsider, message.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('MessagesService.removeLinkPreview', () => {
  const views = { author: channelFor('member'), other: channelFor('member') };
  const linkPreview = {
    url: 'https://example.com',
    siteName: null,
    title: 'Example',
    description: null,
    image: null,
  };

  it('lets the author remove the preview', async () => {
    const { service, stored } = setup(views);
    const { message } = await sendAs(service, author);
    stored.set(message.id, { ...message, linkPreview });

    await expect(
      service.removeLinkPreview(author, message.id)
    ).resolves.toMatchObject({ linkPreview: null });
  });

  it('refuses everyone else', async () => {
    const { service, stored } = setup(views);
    const { message } = await sendAs(service, author);
    stored.set(message.id, { ...message, linkPreview });

    await expect(
      service.removeLinkPreview(other, message.id)
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('MessagesService saved messages', () => {
  it("lists a member's saves and no one else's", async () => {
    const { service } = setup({
      author: channelFor('member'),
      other: channelFor('member'),
    });
    const { message } = await sendAs(service, author);

    await service.save(other, message.id);

    expect(await service.listSaved(other)).toHaveLength(1);
    expect(await service.listSaved(author)).toHaveLength(0);
  });

  it('refuses to save a message in a private channel the viewer cannot see', async () => {
    const { service } = setup({
      author: channelFor('member', { visibility: 'private' }),
      outsider: null,
    });
    const { message } = await sendAs(service, author);

    await expect(service.save(outsider, message.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('hides a save once the viewer loses access to its channel', async () => {
    const views: Record<string, Room | null> = {
      author: channelFor('member'),
      other: channelFor('member', { visibility: 'private' }),
    };
    const { service } = setup(views);
    const { message } = await sendAs(service, author);
    await service.save(other, message.id);

    views.other = null;

    expect(await service.listSaved(other)).toHaveLength(0);
  });

  it('lists a save from a DM the viewer is in', async () => {
    const { service, dmIds } = setup({
      author: channelFor('member', { kind: 'dm', visibility: 'private' }),
    });
    const { message } = await sendAs(service, author);
    await service.save(author, message.id);
    expect(await service.listSaved(author)).toHaveLength(0);

    dmIds.push('c1');

    expect(await service.listSaved(author)).toHaveLength(1);
  });

  it('removes a save', async () => {
    const { service } = setup({ author: channelFor('member') });
    const { message } = await sendAs(service, author);
    await service.save(author, message.id);

    await service.unsave(author, message.id);

    expect(await service.listSaved(author)).toHaveLength(0);
  });
});
