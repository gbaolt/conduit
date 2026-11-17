'use client';

import type { Room } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { IconStar, IconStarFilled } from '@tabler/icons-react';
import type { ComponentProps } from 'react';

import { useStarRoom, useUnstarRoom } from '@/services/rooms/hooks';

/** Stars or unstars a room. Someone outside the room can't star it, so they see nothing. */
export function RoomStarButton({
  room,
  variant = 'ghost',
}: {
  room: Pick<Room, 'id' | 'kind' | 'membership'>;
  variant?: ComponentProps<typeof Button>['variant'];
}) {
  const { mutate: star } = useStarRoom();
  const { mutate: unstar } = useUnstarRoom();

  if (!room.membership) return null;

  const starred = !!room.membership.starredAt;
  const noun = room.kind === 'dm' ? 'conversation' : 'channel';

  return (
    <Button
      variant={variant}
      size="icon-sm"
      aria-pressed={starred}
      aria-label={starred ? `Unstar ${noun}` : `Star ${noun}`}
      onClick={() => (starred ? unstar : star)({ roomId: room.id })}
    >
      {starred ? <IconStarFilled className="text-warning" /> : <IconStar />}
    </Button>
  );
}
