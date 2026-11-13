import {
  effectiveNotify,
  isDndActive,
  type NotificationSettings,
  type NotifyLevel,
  type RoomKind,
} from '@conduit/contract';

import { notificationFor } from './notification-rule';

/** A member is away once their last heartbeat is older than this. */
export const DIGEST_AWAY_MS = 60 * 60 * 1000;

/** An unread `MENTION` item with what the email shows of it, and what the room's rule needs. */
export type DigestMention = {
  roomId: string;
  roomName: string;
  roomKind: RoomKind;
  notify: NotifyLevel | null;
  muted: boolean;
  messageId: string;
  /** The thread's root, when the mention is a reply. */
  parentId: string | null;
  authorName: string;
  /** The stored Markdown. */
  body: string;
  createdAt: Date;
};

/** One member in one workspace, with everything the due rule reads. */
export type DigestCandidate = {
  organizationId: string;
  userId: string;
  email: string;
  name: string;
  /** Null when the member has no `Presence` row, which makes them never due. */
  lastActiveAt: Date | null;
  lastSentAt: Date | null;
  settings: NotificationSettings;
  mentions: DigestMention[];
};

/**
 * The mentions to email the member at `now`, or none when they are not due. A member is due when they have been away
 * for over an hour, the last digest is older than their last heartbeat, and the digest is on with Do Not Disturb off.
 */
export function dueMentions(
  { lastActiveAt, lastSentAt, settings, mentions }: DigestCandidate,
  now: Date
): DigestMention[] {
  if (!lastActiveAt || now.getTime() - lastActiveAt.getTime() <= DIGEST_AWAY_MS)
    return [];
  if (lastSentAt && lastSentAt >= lastActiveAt) return [];
  if (!settings.emailDigest) return [];

  const dnd = isDndActive(settings, now);
  return mentions.filter(
    (mention) =>
      mention.createdAt > lastActiveAt &&
      notificationFor(
        {
          level: effectiveNotify(mention.roomKind, mention.notify),
          muted: mention.muted,
          dnd,
          online: false,
        },
        'mention',
        'email'
      )
  );
}
