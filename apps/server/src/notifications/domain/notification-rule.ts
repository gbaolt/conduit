import type { NotifyLevel } from '@conduit/contract';

/** What happened, from the recipient's side. A DM message with no mention is a `message`, like any other. */
export type NotificationEvent = 'mention' | 'thread_reply' | 'message';

export type NotificationChannel = 'push' | 'email';

/** The recipient as the rule sees them. `level` is already resolved with `effectiveNotify`. */
export type NotificationRecipient = {
  level: NotifyLevel;
  muted: boolean;
  dnd: boolean;
  online: boolean;
};

type Rule = (recipient: NotificationRecipient) => boolean;

const never: Rule = () => false;

/** Per channel and event, whether the recipient hears about it. Do Not Disturb and `nothing` are checked first. */
const RULES: Record<NotificationChannel, Record<NotificationEvent, Rule>> = {
  push: {
    // A mention reaches a muted room's member, so muting a busy channel never hides a question to them.
    mention: ({ online }) => !online,
    thread_reply: ({ online, muted }) => !online && !muted,
    message: ({ online, muted, level }) => !online && !muted && level === 'all',
  },
  email: {
    mention: () => true,
    thread_reply: never,
    message: never,
  },
};

export function notificationFor(
  recipient: NotificationRecipient,
  event: NotificationEvent,
  channel: NotificationChannel
): boolean {
  if (recipient.dnd || recipient.level === 'nothing') return false;
  return RULES[channel][event](recipient);
}
