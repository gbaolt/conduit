import type {
  Message,
  NotificationSettings,
  NotifyLevel,
  RoomKind,
} from '@conduit/contract';

import type { PushTarget } from './push-sender.port';

/** One member who may be pushed about a message, with everything `notificationFor` needs. */
export type PushRecipient = {
  userId: string;
  /** The Activity item the message gave them. Null when it gave none. */
  itemKind: 'mention' | 'thread_reply' | null;
  /** The level they set for the room. Null means the room kind's default. */
  notify: NotifyLevel | null;
  muted: boolean;
  settings: Pick<NotificationSettings, 'dndUntil' | 'dndSchedule' | 'timeZone'>;
  presence: { lastActiveAt: Date; away: boolean } | undefined;
  /** One per browser. Never empty. */
  targets: PushTarget[];
};

export type PushAudience = {
  room: { name: string; kind: RoomKind };
  authorName: string;
  /** Names of the members the body mentions, by user id. */
  mentionNames: Record<string, string>;
  recipients: PushRecipient[];
};

export abstract class PushAudienceRepository {
  /**
   * The workspace members of the message's room, other than its author, who have a subscription.
   * Null when the room is gone.
   */
  abstract audienceFor(
    message: Pick<Message, 'id' | 'roomId' | 'authorId' | 'mentionedUserIds'>
  ): Promise<PushAudience | null>;
}
