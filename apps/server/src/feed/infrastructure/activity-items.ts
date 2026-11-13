import type { ActivityKind } from '@conduit/contract';
import type { Prisma } from '@generated/prisma/client';

import type { NewActivityItem } from '@/feed/domain/feed.repository';

export const PRISMA_KINDS = {
  mention: 'MENTION',
  thread_reply: 'THREAD_REPLY',
  reaction: 'REACTION',
  room_add: 'ROOM_ADD',
} as const satisfies Record<ActivityKind, string>;

/** Inserts the items inside the transaction of the change that caused them. A key that exists is skipped, so a repeated write is one row. */
export function createActivityItems(
  tx: Prisma.TransactionClient,
  items: NewActivityItem[]
) {
  return tx.activityItem.createMany({
    data: items.map((item) => ({ ...item, kind: PRISMA_KINDS[item.kind] })),
    skipDuplicates: true,
  });
}
