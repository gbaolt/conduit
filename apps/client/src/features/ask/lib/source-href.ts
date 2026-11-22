import type { AnswerSource } from '@conduit/contract';
import type { Route } from 'next';

/** The cited message in its conversation, or the message that carried the cited file, with `?thread=` for a reply. */
export function sourceHref(source: AnswerSource): Route {
  const { room, parentId } =
    source.type === 'message' ? source.message : source.file;
  const messageId =
    source.type === 'message' ? source.message.id : source.file.messageId;
  const params = new URLSearchParams();
  if (parentId) params.set('thread', parentId);
  params.set('message', messageId);
  return `${room.kind === 'dm' ? '/dms' : '/channels'}/${room.id}?${params}` as Route;
}
