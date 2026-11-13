/**
 * Counts the database writes per minute that typing, drafts, read state, and presence cause when ten members
 * are online in one channel and all of them type.
 *
 *   pnpm --filter server measure:write-rate
 *
 * It drives the real `ActivityService` and the real pacing code (`createComposerActivity`,
 * `createTrailingWriter`) on a virtual clock against an in-memory repository, so it never touches a database.
 * Each member also sends a message every 30 s, which clears their draft and makes the other nine read to the end.
 * Two typing profiles run: `steady` types for 8 s and pauses 1.2 s, and `stutter` pauses 1.2 s after every 2 s,
 * the worst case for draft saves. Exits 1 when either profile writes more than 600 times per minute.
 */
import 'reflect-metadata';

import { mock } from 'node:test';

import {
  createComposerActivity,
  createTrailingWriter,
  HEARTBEAT_INTERVAL_MS,
  READ_DEBOUNCE_MS,
  READ_MIN_INTERVAL_MS,
} from '@conduit/contract';

import { ActivityService } from '@/activity/application/activity.service';
import { InMemoryActivityRepository } from '@/activity/testing/in-memory-activity.repository';
import type { FeedRepository } from '@/feed/domain/feed.repository';
import type { RoomsRepository } from '@/rooms/domain/rooms.repository';

const MEMBERS = 10;
const MINUTES = 10;
const STEP_MS = 200;
const SEND_EVERY_MS = 30_000;
const LIMIT_PER_MINUTE = 600;
const sendSpacingMs = SEND_EVERY_MS / MEMBERS;

const PROFILES = {
  steady: { typeMs: 8000, pauseMs: 1200 },
  stutter: { typeMs: 2000, pauseMs: 1200 },
} as const;

const channel = {
  visibility: 'public',
  isDefault: false,
  archivedAt: null,
  membership: {
    role: 'member',
    starredAt: null,
    sectionId: null,
    notify: null,
    mutedAt: null,
  },
};

// Lets the service's awaited calls finish between virtual ticks.
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

async function run(profile: keyof typeof PROFILES) {
  const { typeMs, pauseMs } = PROFILES[profile];
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 0 });

  const messages = new Map<string, { roomId: string; createdAt: Date }>();
  const repository = new InMemoryActivityRepository(messages);
  const service = new ActivityService(
    repository,
    { find: async () => channel } as unknown as RoomsRepository,
    // The feed's own write is not part of the read-state rate this script measures.
    {
      markReadThroughPosition: async () => undefined,
    } as unknown as FeedRepository
  );

  const members = Array.from({ length: MEMBERS }, (_, index) => {
    const viewer = {
      userId: `user-${index}`,
      organizationId: 'org',
      workspaceRole: 'member' as const,
    };
    const key = { roomId: 'c1' };
    const activity = createComposerActivity({
      saved: '',
      saveDraft: (body) => void service.saveDraft(viewer, key, body),
      ping: () => void service.ping(viewer, key),
    });
    const markRead = createTrailingWriter(
      (messageId: string) =>
        void service.markRead(viewer, { roomId: 'c1', messageId }),
      { debounceMs: READ_DEBOUNCE_MS, minIntervalMs: READ_MIN_INTERVAL_MS }
    );
    // Members start at different moments, as real tabs do.
    const offsetMs = index * 317;
    setInterval(
      () => void service.heartbeat(viewer, false),
      HEARTBEAT_INTERVAL_MS
    );
    return { activity, markRead, offsetMs, text: '', sent: 0 };
  });

  for (let elapsed = 0; elapsed < MINUTES * 60_000; elapsed += STEP_MS) {
    members.forEach((member, index) => {
      const local = elapsed + member.offsetMs;
      const typing = local % (typeMs + pauseMs) < typeMs;

      // Sends are spread evenly across the 30 s, so the other nine see one message about every 1.5 s.
      const sendDueAt =
        (member.sent + 1) * SEND_EVERY_MS - index * sendSpacingMs;
      if (elapsed >= sendDueAt) {
        member.sent++;
        const id = `m-${index}-${member.sent}`;
        messages.set(id, { roomId: 'c1', createdAt: new Date(elapsed) });
        member.text = '';
        member.activity.change('');
        members.forEach((other, otherIndex) => {
          if (otherIndex !== index) other.markRead.push(id);
        });
      } else if (typing) {
        member.text += 'x';
        member.activity.change(member.text);
      }
    });
    mock.timers.tick(STEP_MS);
    await settle();
  }
  mock.timers.reset();

  return { counts: repository.counts, writes: repository.writes };
}

let worst = 0;
for (const profile of Object.keys(PROFILES) as (keyof typeof PROFILES)[]) {
  const { counts, writes } = await run(profile);
  const perMinute = writes / MINUTES;
  worst = Math.max(worst, perMinute);
  console.log(
    `${profile}: ${perMinute.toFixed(0)} writes/min`,
    Object.fromEntries(
      Object.entries(counts).map(([kind, count]) => [
        kind,
        Math.round(count / MINUTES),
      ])
    )
  );
}

console.log(`worst: ${worst.toFixed(0)} writes/min, limit ${LIMIT_PER_MINUTE}`);
process.exit(worst > LIMIT_PER_MINUTE ? 1 : 0);
