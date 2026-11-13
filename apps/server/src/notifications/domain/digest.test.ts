import { DEFAULT_NOTIFICATION_SETTINGS } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import {
  type DigestCandidate,
  type DigestMention,
  dueMentions,
} from './digest';

const now = new Date('2026-11-13T12:00:00Z');
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60_000);

const mention = (overrides: Partial<DigestMention> = {}): DigestMention => ({
  roomId: 'room',
  roomName: 'design',
  roomKind: 'channel',
  notify: null,
  muted: false,
  messageId: 'message',
  parentId: null,
  authorName: 'Linh',
  body: 'Can you review this?',
  createdAt: minutesAgo(70),
  ...overrides,
});

const candidate = (
  overrides: Partial<DigestCandidate> = {}
): DigestCandidate => ({
  organizationId: 'org',
  userId: 'bao',
  email: 'bao@test.local',
  name: 'Bao',
  lastActiveAt: minutesAgo(90),
  lastSentAt: null,
  settings: DEFAULT_NOTIFICATION_SETTINGS,
  mentions: [mention()],
  ...overrides,
});

describe('dueMentions', () => {
  it('sends the mentions of a member who has been away for over an hour', () => {
    const mentions = [mention(), mention({ messageId: 'second' })];

    expect(dueMentions(candidate({ mentions }), now)).toEqual(mentions);
  });

  it('waits until the heartbeat is more than an hour old', () => {
    expect(
      dueMentions(candidate({ lastActiveAt: minutesAgo(60) }), now)
    ).toEqual([]);
    expect(
      dueMentions(candidate({ lastActiveAt: minutesAgo(59) }), now)
    ).toEqual([]);
    expect(
      dueMentions(
        candidate({
          lastActiveAt: minutesAgo(61),
          mentions: [mention({ createdAt: minutesAgo(30) })],
        }),
        now
      )
    ).toHaveLength(1);
  });

  it('is never due without a presence row', () => {
    expect(dueMentions(candidate({ lastActiveAt: null }), now)).toEqual([]);
  });

  it('sends once per away period', () => {
    expect(dueMentions(candidate({ lastSentAt: minutesAgo(30) }), now)).toEqual(
      []
    );
    expect(dueMentions(candidate({ lastSentAt: minutesAgo(90) }), now)).toEqual(
      []
    );
    expect(
      dueMentions(candidate({ lastSentAt: minutesAgo(120) }), now)
    ).toHaveLength(1);
  });

  it('sends nothing when the digest is off', () => {
    const settings = { ...DEFAULT_NOTIFICATION_SETTINGS, emailDigest: false };

    expect(dueMentions(candidate({ settings }), now)).toEqual([]);
  });

  it('waits out Do Not Disturb', () => {
    const snoozed = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      dndUntil: new Date(now.getTime() + 60_000),
    };
    const expired = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      dndUntil: new Date(now.getTime() - 60_000),
    };

    expect(dueMentions(candidate({ settings: snoozed }), now)).toEqual([]);
    expect(dueMentions(candidate({ settings: expired }), now)).toHaveLength(1);
  });

  it('waits out a Do Not Disturb schedule in the member time zone', () => {
    // 12:00 UTC is 19:00 in Ho Chi Minh City, on a Friday (5).
    const settings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      timeZone: 'Asia/Ho_Chi_Minh',
      dndSchedule: { days: [5], start: '18:00', end: '23:00' },
    };

    expect(dueMentions(candidate({ settings }), now)).toEqual([]);
  });

  it('skips mentions older than the last heartbeat', () => {
    const before = mention({ messageId: 'before', createdAt: minutesAgo(100) });
    const after = mention({ messageId: 'after', createdAt: minutesAgo(80) });

    expect(dueMentions(candidate({ mentions: [before, after] }), now)).toEqual([
      after,
    ]);
  });

  it('skips a room at level nothing but not a muted one, since a mention reaches a muted room', () => {
    const nothing = mention({ messageId: 'nothing', notify: 'nothing' });
    const muted = mention({ messageId: 'muted', muted: true });

    expect(dueMentions(candidate({ mentions: [nothing, muted] }), now)).toEqual(
      [muted]
    );
  });

  it('is not due when no mention is left to send', () => {
    expect(dueMentions(candidate({ mentions: [] }), now)).toEqual([]);
  });
});
