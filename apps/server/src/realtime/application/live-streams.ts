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

/**
 * The SQL each stream may run. The client never sends SQL, only a stream.
 * New messages, edits, deletes, reactions, reply counts, pins, and previews all bump `updatedAt`,
 * so one query carries every change to a conversation.
 */
export function queryFor(stream: LiveStream): LiveQuery {
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
  }
}
