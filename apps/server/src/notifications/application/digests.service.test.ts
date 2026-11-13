import { DEFAULT_NOTIFICATION_SETTINGS } from '@conduit/contract';
import { describe, expect, it, vi } from 'vitest';

import type {
  DigestCandidate,
  DigestMention,
} from '@/notifications/domain/digest';
import type { DigestMailer } from '@/notifications/domain/digest-mailer.port';
import type {
  DigestScope,
  DigestsRepository,
} from '@/notifications/domain/digests.repository';

import { DigestsService } from './digests.service';

const now = new Date('2026-11-13T12:00:00Z');
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60_000);

const mention: DigestMention = {
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
};

const candidate = (
  userId: string,
  overrides: Partial<DigestCandidate> = {}
): DigestCandidate => ({
  organizationId: 'org',
  userId,
  email: `${userId}@test.local`,
  name: userId,
  lastActiveAt: minutesAgo(90),
  lastSentAt: null,
  settings: DEFAULT_NOTIFICATION_SETTINGS,
  mentions: [mention],
  ...overrides,
});

/** Claims behave like the SQL: a claim succeeds only while the stored time is older than the heartbeat. */
function fakeRepository(candidates: DigestCandidate[]) {
  const sentAt = new Map(
    candidates.map((row) => [
      `${row.organizationId}:${row.userId}`,
      row.lastSentAt,
    ])
  );
  const key = (scope: DigestScope) => `${scope.organizationId}:${scope.userId}`;

  const repository: DigestsRepository = {
    candidates: () => Promise.resolve(candidates),
    claim: (scope, lastActiveAt, at) => {
      const stored = sentAt.get(key(scope)) ?? null;
      if (stored && stored >= lastActiveAt) return Promise.resolve(false);
      sentAt.set(key(scope), at);
      return Promise.resolve(true);
    },
    release: (scope, claimedAt, previous) => {
      if (sentAt.get(key(scope))?.getTime() === claimedAt.getTime()) {
        sentAt.set(key(scope), previous);
      }
      return Promise.resolve();
    },
  };
  return { repository, sentAt };
}

const fakeMailer = () => {
  const send = vi.fn<DigestMailer['send']>(() => Promise.resolve());
  return { mailer: { send } satisfies DigestMailer, send };
};

describe('DigestsService.sendDigests', () => {
  it('emails each due member once and returns the count', async () => {
    const { repository } = fakeRepository([
      candidate('bao'),
      candidate('mai'),
      candidate('lan', { lastActiveAt: minutesAgo(10) }),
    ]);
    const { mailer, send } = fakeMailer();

    const sent = await new DigestsService(repository, mailer).sendDigests(now);

    expect(sent).toBe(2);
    expect(send.mock.calls.map(([digest]) => digest.to)).toEqual([
      'bao@test.local',
      'mai@test.local',
    ]);
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      recipient: { userId: 'bao', name: 'bao' },
      mentions: [mention],
    });
  });

  it('sends one email when two runs overlap', async () => {
    const { repository } = fakeRepository([candidate('bao')]);
    const { mailer, send } = fakeMailer();
    const service = new DigestsService(repository, mailer);

    const counts = await Promise.all([
      service.sendDigests(now),
      service.sendDigests(now),
    ]);

    expect(send).toHaveBeenCalledTimes(1);
    expect(counts.sort()).toEqual([0, 1]);
  });

  it('sends nothing more for the same away period on a later run', async () => {
    const { repository } = fakeRepository([candidate('bao')]);
    const { mailer, send } = fakeMailer();
    const service = new DigestsService(repository, mailer);

    await service.sendDigests(now);
    const later = await service.sendDigests(new Date(now.getTime() + 900_000));

    expect(later).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('releases the claim when the mailer fails, so the next run retries', async () => {
    const { repository, sentAt } = fakeRepository([candidate('bao')]);
    const { mailer, send } = fakeMailer();
    send.mockRejectedValueOnce(new Error('Resend refused'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = new DigestsService(repository, mailer);

    await expect(service.sendDigests(now)).resolves.toBe(0);
    expect(sentAt.get('org:bao')).toBeNull();

    await expect(service.sendDigests(now)).resolves.toBe(1);
  });

  it('keeps going after one member fails', async () => {
    const { repository } = fakeRepository([candidate('bao'), candidate('mai')]);
    const { mailer, send } = fakeMailer();
    send.mockRejectedValueOnce(new Error('Resend refused'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      new DigestsService(repository, mailer).sendDigests(now)
    ).resolves.toBe(1);
  });

  it('asks for members whose heartbeat is over an hour old', async () => {
    const { repository } = fakeRepository([]);
    const candidates = vi.spyOn(repository, 'candidates');

    await new DigestsService(repository, fakeMailer().mailer).sendDigests(now);

    expect(candidates).toHaveBeenCalledWith(minutesAgo(60));
  });
});
