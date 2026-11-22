import type { ChannelVisibility, RoomKind } from '@/schemas/rooms';

export type ShareSource = {
  room: { id: string; kind: RoomKind; visibility: ChannelVisibility };
};

/**
 * Whether a sent file may be attached to a message in `targetRoomId`. A public channel's file may go anywhere,
 * since every member can already read it. Any other file stays in the room it was shared in.
 */
export function canAttachToRoom(source: ShareSource, targetRoomId: string) {
  if (source.room.id === targetRoomId) return true;
  return source.room.kind === 'channel' && source.room.visibility === 'public';
}
