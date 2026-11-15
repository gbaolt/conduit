import { ORPCError } from '@orpc/client';
import { notFound, redirect } from 'next/navigation';

/**
 * Sends a missing room to the not-found page and a room opened at the wrong kind of URL to the right one.
 * It renders nothing, so the page renders from the browser's cache without waiting for the room.
 */
export async function RoomGuard({
  roomId,
  room,
  kind,
}: {
  roomId: string;
  room: Promise<{ kind: string }>;
  kind: 'channel' | 'dm';
}) {
  const actual = await room.then(
    (loaded) => loaded.kind,
    (error: unknown) => {
      if (error instanceof ORPCError && error.code === 'NOT_FOUND') notFound();
      throw error;
    }
  );

  if (actual !== kind) {
    redirect(actual === 'dm' ? `/dms/${roomId}` : `/channels/${roomId}`);
  }
  return null;
}
