import type { Message, PushPayload } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import type {
  PushAudience,
  PushRecipient,
} from '../domain/push-audience.repository';
import type {
  PushResult,
  PushSender,
  PushTarget,
} from '../domain/push-sender.port';
import { PushNotificationsService } from './push-notifications.service';

const message = {
  id: 'm1',
  roomId: 'r1',
  authorId: 'author',
  parentId: null,
  body: 'hello',
  mentionedUserIds: [],
  deletedAt: null,
} as unknown as Message;

const target = (endpoint: string): PushTarget => ({
  endpoint,
  p256dh: 'k',
  auth: 'a',
});

const recipient = (overrides: Partial<PushRecipient> = {}): PushRecipient => ({
  userId: 'bao',
  itemKind: null,
  notify: null,
  muted: false,
  settings: { dndUntil: null, dndSchedule: null, timeZone: 'UTC' },
  presence: undefined,
  targets: [target('https://push.test/1')],
  ...overrides,
});

function setup(
  recipients: PushRecipient[],
  {
    roomKind = 'channel' as 'channel' | 'dm',
    outcome = (): PushResult => 'sent',
    enabled = true,
  } = {}
) {
  const sent: { endpoint: string; payload: PushPayload; ttl: number }[] = [];
  const forgotten: string[] = [];
  const delivered: string[] = [];
  const sender: PushSender = {
    enabled,
    send: async (to, payload, { ttlSeconds }) => {
      sent.push({ endpoint: to.endpoint, payload, ttl: ttlSeconds });
      return outcome();
    },
  };
  const audience: PushAudience = {
    room: { name: 'design', kind: roomKind },
    authorName: 'Linh',
    mentionNames: {},
    recipients,
  };
  const service = new PushNotificationsService(
    { audienceFor: async () => audience },
    {
      subscribe: async () => {},
      unsubscribe: async () => {},
      forget: async (endpoint) => void forgotten.push(endpoint),
      markDelivered: async (endpoints) => void delivered.push(...endpoints),
    },
    sender
  );
  return { service, sent, forgotten, delivered };
}

describe('PushNotificationsService.dispatchMessage', () => {
  it('pushes a mention once per browser, with a one hour TTL and the payload', async () => {
    const { service, sent, delivered } = setup([
      recipient({
        itemKind: 'mention',
        targets: [target('https://push.test/a'), target('https://push.test/b')],
      }),
    ]);

    await service.dispatchMessage(message);

    expect(sent.map((push) => push.endpoint)).toEqual([
      'https://push.test/a',
      'https://push.test/b',
    ]);
    expect(sent[0]).toMatchObject({
      ttl: 3600,
      payload: { title: 'Linh in #design', body: 'hello', tag: 'r1' },
    });
    expect(delivered).toEqual(['https://push.test/a', 'https://push.test/b']);
  });

  it('deletes a subscription the push service reports gone, and keeps the others', async () => {
    const { service, forgotten, delivered } = setup(
      [
        recipient({
          itemKind: 'mention',
          targets: [
            target('https://push.test/gone'),
            target('https://push.test/ok'),
          ],
        }),
      ],
      {
        outcome: (() => {
          const results: PushResult[] = ['gone', 'sent'];
          return () => results.shift() ?? 'sent';
        })(),
      }
    );

    await service.dispatchMessage(message);

    expect(forgotten).toEqual(['https://push.test/gone']);
    expect(delivered).toEqual(['https://push.test/ok']);
  });

  it('keeps going when one send throws', async () => {
    const { service, delivered } = setup(
      [
        recipient({
          itemKind: 'mention',
          targets: [
            target('https://push.test/a'),
            target('https://push.test/b'),
          ],
        }),
      ],
      {
        outcome: (() => {
          let calls = 0;
          return (): PushResult => {
            if (calls++ === 0) throw new Error('push service down');
            return 'sent';
          };
        })(),
      }
    );

    await service.dispatchMessage(message);

    expect(delivered).toEqual(['https://push.test/b']);
  });

  it('reads the event from the member item, so a muted room still pushes a mention but not a thread reply', async () => {
    const mentioned = setup([recipient({ itemKind: 'mention', muted: true })]);
    await mentioned.service.dispatchMessage(message);
    expect(mentioned.sent).toHaveLength(1);

    const replied = setup([
      recipient({ itemKind: 'thread_reply', muted: true }),
    ]);
    await replied.service.dispatchMessage(message);
    expect(replied.sent).toHaveLength(0);

    const unmuted = setup([recipient({ itemKind: 'thread_reply' })]);
    await unmuted.service.dispatchMessage(message);
    expect(unmuted.sent).toHaveLength(1);
  });

  it('pushes a plain channel message only at level all, and a DM at the default level', async () => {
    const byDefault = setup([recipient()]);
    await byDefault.service.dispatchMessage(message);
    expect(byDefault.sent).toHaveLength(0);

    const all = setup([recipient({ notify: 'all' })]);
    await all.service.dispatchMessage(message);
    expect(all.sent).toHaveLength(1);

    const dm = setup([recipient()], { roomKind: 'dm' });
    await dm.service.dispatchMessage(message);
    expect(dm.sent).toHaveLength(1);
    expect(dm.sent[0]?.payload.title).toBe('Linh');
  });

  it('pushes a reply kept in its thread only to the people it is for', async () => {
    const reply = { ...message, parentId: 'root', alsoSentToChannel: false };
    const { service, sent } = setup([
      recipient({ userId: 'all', notify: 'all' }),
      recipient({
        userId: 'starter',
        itemKind: 'thread_reply',
        targets: [target('https://push.test/starter')],
      }),
    ]);
    await service.dispatchMessage(reply);
    expect(sent.map(({ endpoint }) => endpoint)).toEqual([
      'https://push.test/starter',
    ]);

    const shown = setup([recipient({ notify: 'all' })]);
    await shown.service.dispatchMessage({ ...reply, alsoSentToChannel: true });
    expect(shown.sent).toHaveLength(1);
  });

  it('sends nothing at level nothing, during Do Not Disturb, or to a member who is online', async () => {
    const nothing = setup([
      recipient({ itemKind: 'mention', notify: 'nothing' }),
    ]);
    const dnd = setup([
      recipient({
        itemKind: 'mention',
        settings: {
          dndUntil: new Date(Date.now() + 60_000),
          dndSchedule: null,
          timeZone: 'UTC',
        },
      }),
    ]);
    const online = setup([
      recipient({
        itemKind: 'mention',
        presence: { lastActiveAt: new Date(), away: false },
      }),
    ]);

    for (const { service } of [nothing, dnd, online]) {
      await service.dispatchMessage(message);
    }

    expect([nothing, dnd, online].map(({ sent }) => sent.length)).toEqual([
      0, 0, 0,
    ]);
  });

  it('does nothing without VAPID keys or for a deleted message', async () => {
    const off = setup([recipient({ itemKind: 'mention' })], { enabled: false });
    await off.service.dispatchMessage(message);
    expect(off.sent).toHaveLength(0);

    const deleted = setup([recipient({ itemKind: 'mention' })]);
    await deleted.service.dispatchMessage({
      ...message,
      deletedAt: new Date(),
    });
    expect(deleted.sent).toHaveLength(0);
  });
});
