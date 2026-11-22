import type { AnswerSource } from '@conduit/contract';
import type { Route } from 'next';

/**
 * Where a source opens. A message, or the message that carried a file, opens in its conversation with `?thread=`
 * for a reply. A channel opens itself, a draft opens where it waits to be sent, and a person opens in the People
 * directory.
 */
export function sourceHref(source: AnswerSource): Route {
  const params = new URLSearchParams();
  switch (source.type) {
    case 'channel':
      return `/channels/${source.channel.id}` as Route;
    case 'person':
      params.set('q', source.person.name);
      return `/directories/people?${params}` as Route;
    case 'draft':
      if (source.draft.parentId) params.set('thread', source.draft.parentId);
      return `/channels/${source.draft.room.id}${params.size ? `?${params}` : ''}` as Route;
  }
  const { room, parentId } =
    source.type === 'message' ? source.message : source.file;
  const messageId =
    source.type === 'message' ? source.message.id : source.file.messageId;
  if (parentId) params.set('thread', parentId);
  params.set('message', messageId);
  return `${room.kind === 'dm' ? '/dms' : '/channels'}/${room.id}?${params}` as Route;
}
