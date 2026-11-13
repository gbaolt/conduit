import { describe, expect, it } from 'vitest';

import {
  type NotificationChannel,
  type NotificationEvent,
  notificationFor,
  type NotificationRecipient,
} from './notification-rule';

const away: NotificationRecipient = {
  level: 'mentions',
  muted: false,
  dnd: false,
  online: false,
};

const cases: [
  string,
  Partial<NotificationRecipient>,
  NotificationEvent,
  NotificationChannel,
  boolean,
][] = [
  ['pushes a mention to an away member', {}, 'mention', 'push', true],
  [
    'pushes a mention in a muted room',
    { muted: true },
    'mention',
    'push',
    true,
  ],
  ['pushes a thread reply', {}, 'thread_reply', 'push', true],
  [
    'skips a thread reply in a muted room',
    { muted: true },
    'thread_reply',
    'push',
    false,
  ],
  ['skips a plain message at the mentions level', {}, 'message', 'push', false],
  [
    'pushes a plain message at the all level',
    { level: 'all' },
    'message',
    'push',
    true,
  ],
  [
    'skips a plain message in a muted room at all',
    { level: 'all', muted: true },
    'message',
    'push',
    false,
  ],
  [
    'never pushes to an online member',
    { online: true },
    'mention',
    'push',
    false,
  ],
  [
    'sends nothing at the nothing level',
    { level: 'nothing' },
    'mention',
    'push',
    false,
  ],
  [
    'sends nothing during Do Not Disturb',
    { dnd: true },
    'mention',
    'push',
    false,
  ],
  ['emails a mention', {}, 'mention', 'email', true],
  [
    'emails a mention in a muted room',
    { muted: true },
    'mention',
    'email',
    true,
  ],
  [
    'emails a mention to a member who is online',
    { online: true },
    'mention',
    'email',
    true,
  ],
  ['never emails a thread reply', {}, 'thread_reply', 'email', false],
  ['never emails a plain message', { level: 'all' }, 'message', 'email', false],
  [
    'emails nothing during Do Not Disturb',
    { dnd: true },
    'mention',
    'email',
    false,
  ],
  [
    'emails nothing at the nothing level',
    { level: 'nothing' },
    'mention',
    'email',
    false,
  ],
];

describe('notificationFor', () => {
  it.each(cases)('%s', (_, patch, event, channel, expected) => {
    expect(notificationFor({ ...away, ...patch }, event, channel)).toBe(
      expected
    );
  });
});
