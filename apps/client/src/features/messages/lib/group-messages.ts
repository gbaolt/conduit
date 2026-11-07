import type { Message } from '@conduit/contract';

import type { PendingMessage } from '@/services/messages/hooks';

export const GROUP_WINDOW_MS = 5 * 60 * 1000;

/** One row of the log: a stored message, or one the member sent that the server has not confirmed. */
export type LogEntry = (
  | { kind: 'message'; message: Message }
  | { kind: 'pending'; pending: PendingMessage }
) & {
  key: string;
  authorId: string;
  createdAt: Date;
  /** Continues the previous row's author, so it shows no avatar or name. */
  grouped: boolean;
  /** The first row of a calendar day in the viewer's time zone. */
  startsDay: boolean;
};

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/**
 * Lays messages out oldest first and appends pending ones. A pending message whose `clientId` the server
 * has already returned is dropped, since the stored message replaces it.
 */
export function buildLog(
  messages: readonly Message[],
  pending: readonly PendingMessage[],
  authorId: string
): LogEntry[] {
  const stored = new Set(messages.map((message) => message.clientId));
  const rows = [
    ...messages.map((message) => ({
      kind: 'message' as const,
      message,
      key: message.id,
      authorId: message.authorId,
      createdAt: message.createdAt,
      deleted: message.deletedAt !== null,
    })),
    ...pending
      .filter((item) => !stored.has(item.clientId))
      .map((item) => ({
        kind: 'pending' as const,
        pending: item,
        key: `pending-${item.clientId}`,
        authorId,
        createdAt: item.createdAt,
        deleted: false,
      })),
  ];

  return rows.map(({ deleted, ...row }, index) => {
    const previous = rows[index - 1];
    const startsDay =
      !previous || dayKey(previous.createdAt) !== dayKey(row.createdAt);
    const grouped =
      !startsDay &&
      !deleted &&
      !previous?.deleted &&
      previous?.authorId === row.authorId &&
      row.createdAt.getTime() - previous.createdAt.getTime() < GROUP_WINDOW_MS;

    return { ...row, grouped, startsDay };
  });
}

const sameYear = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});
const otherYear = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

/** "Today", "Yesterday", or "Tuesday, November 4". */
export function dayLabel(date: Date, now: Date) {
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) /
      86_400_000
  );
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return (
    date.getFullYear() === now.getFullYear() ? sameYear : otherYear
  ).format(date);
}
