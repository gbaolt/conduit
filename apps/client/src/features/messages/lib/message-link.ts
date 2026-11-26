import type { Route } from 'next';

/** A message in its conversation, or in its thread panel for a reply. */
export function messagePath(message: {
  id: string;
  roomId: string;
  parentId: string | null;
  kind: 'channel' | 'dm';
}): Route {
  const params = new URLSearchParams();
  if (message.parentId) params.set('thread', message.parentId);
  params.set('message', message.id);
  const base = message.kind === 'dm' ? '/dms' : '/channels';
  return `${base}/${message.roomId}?${params}` as Route;
}
