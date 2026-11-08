import type { LiveStream } from '@conduit/contract';

import type { LiveQuery } from '@/realtime/domain/live-queries.port';

/** The columns of `Message` that `MessageSchema` reads. */
const MESSAGE_COLUMNS = [
  'id',
  'channelId',
  'authorId',
  'clientId',
  'parentId',
  'alsoSentToChannel',
  'body',
  'mentionedUserIds',
  'mentionsChannel',
  'mentionsHere',
  'reactions',
  'replyCount',
  'lastReplyAt',
  'linkPreview',
  'pinnedAt',
  'pinnedById',
  'editedAt',
  'deletedAt',
  'createdAt',
  'updatedAt',
]
  .map((column) => `"${column}"`)
  .join(', ');

/** Who is asking. The server fills the viewer's ids into a query, so a client can only ask for its own rows. */
export type StreamViewer = { userId: string; organizationId: string };

/**
 * The SQL each stream may run. The client never sends SQL, only a stream.
 * New messages, edits, deletes, reactions, reply counts, pins, and previews all bump `updatedAt`,
 * so one query carries every change to a conversation.
 */
export function queryFor(stream: LiveStream, viewer: StreamViewer): LiveQuery {
  switch (stream.kind) {
    case 'conversation':
      return {
        sql: `SELECT ${MESSAGE_COLUMNS} FROM "Message" WHERE "channelId" = $1 AND ("parentId" IS NULL OR "alsoSentToChannel") AND "updatedAt" >= $2`,
        parameters: [stream.channelId, stream.since],
      };
    case 'thread':
      // The root rides along so its edits and reactions reach the open panel. `channelId` stays in the
      // predicate, so a `parentId` from another channel matches nothing.
      return {
        sql: `SELECT ${MESSAGE_COLUMNS} FROM "Message" WHERE "channelId" = $1 AND ("parentId" = $2 OR "id" = $2) AND "updatedAt" >= $3`,
        parameters: [stream.channelId, stream.parentId, stream.since],
      };
    case 'typing':
      return {
        sql: 'SELECT "userId", "parentId", "until" FROM "TypingState" WHERE "channelId" = $1 AND "until" >= $2 AND "userId" <> $3',
        parameters: [stream.channelId, stream.since, viewer.userId],
      };
    case 'sidebar':
      return {
        sql: `SELECT cm."channelId", c."lastMessageAt", cm."joinedAt", rs."lastReadAt", (d."channelId" IS NOT NULL) AS "hasDraft"
FROM "ChannelMember" cm
JOIN "Channel" c ON c."id" = cm."channelId"
LEFT JOIN "ReadState" rs ON rs."channelId" = cm."channelId" AND rs."userId" = cm."userId"
LEFT JOIN "Draft" d ON d."channelId" = cm."channelId" AND d."userId" = cm."userId" AND d."parentId" = ''
WHERE cm."userId" = $1 AND c."organizationId" = $2`,
        parameters: [viewer.userId, viewer.organizationId],
      };
    case 'presence':
      return {
        sql: 'SELECT "userId", "lastActiveAt", "away" FROM "Presence" WHERE "organizationId" = $1',
        parameters: [viewer.organizationId],
      };
  }
}
