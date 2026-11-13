import type { Message, PushPayload } from '@conduit/contract';

import type { PushAudience } from './push-audience.repository';

export const PUSH_BODY_MAX = 120;

/** Markdown reduced to the text a person reads: mentions as `@name`, links as their label, no markers. */
export function plainText(
  markdown: string,
  mentionNames: Record<string, string>
) {
  return markdown
    .replace(/<@([\w-]+)>/g, (_, id: string) => `@${mentionNames[id] ?? id}`)
    .replace(/```[^\n]*\n?/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/(\*\*|__|~~|[*_`])/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Where a click opens the message: its conversation, or the thread panel for a reply. */
function messageUrl(
  message: Pick<Message, 'id' | 'roomId' | 'parentId'>,
  roomKind: PushAudience['room']['kind']
) {
  const params = new URLSearchParams();
  if (message.parentId) params.set('thread', message.parentId);
  params.set('message', message.id);
  return `${roomKind === 'dm' ? '/dms' : '/channels'}/${message.roomId}?${params}`;
}

export function pushPayloadFor(
  message: Pick<Message, 'id' | 'roomId' | 'parentId' | 'body'>,
  audience: Pick<PushAudience, 'room' | 'authorName' | 'mentionNames'>
): PushPayload {
  const { room, authorName, mentionNames } = audience;
  return {
    title: room.kind === 'dm' ? authorName : `${authorName} in #${room.name}`,
    body: plainText(message.body, mentionNames).slice(0, PUSH_BODY_MAX),
    url: messageUrl(message, room.kind),
    tag: message.roomId,
  };
}
