import type { Room, RoomKind } from '@conduit/contract';
import { ORPCError } from '@orpc/client';

/** What a room page shows: the room, a loading shell, why it cannot, or the URL the room really lives at. */
export type RoomGateState =
  | { status: 'ready'; room: Room }
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'failed' }
  | { status: 'moved'; href: `/channels/${string}` | `/dms/${string}` };

/**
 * A room the browser holds always shows, even while a refresh fails. Without one, a NOT_FOUND means the
 * room is gone or hidden, and any other failure, a rate limit included, can be retried.
 */
export function roomGateState(
  kind: RoomKind,
  room: Room | undefined,
  failure: unknown
): RoomGateState {
  if (room) {
    if (room.kind === kind) return { status: 'ready', room };
    return {
      status: 'moved',
      href: room.kind === 'dm' ? `/dms/${room.id}` : `/channels/${room.id}`,
    };
  }
  if (failure instanceof ORPCError && failure.code === 'NOT_FOUND') {
    return { status: 'missing' };
  }
  return failure ? { status: 'failed' } : { status: 'loading' };
}
