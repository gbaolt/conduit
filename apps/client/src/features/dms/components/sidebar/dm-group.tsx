'use client';

import { DropdownMenuItem } from '@conduit/ui/components/dropdown-menu';
import { IconEdit, IconMessage, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { useCompose } from '@/hooks/use-compose';
import { isUnread, sidebarStateQuery } from '@/services/activity/queries';
import { useCloseDms } from '@/services/dms/hooks';

/**
 * The Direct messages group's own rows of its "More actions" menu. `roomIds` are the DMs the group shows.
 * "Close read conversations" clears the ones with nothing unread, and each returns when a message arrives.
 */
export function DmGroupMenuItems({ roomIds }: { roomIds: string[] }) {
  const [, setCompose] = useCompose();
  const { mutate: close } = useCloseDms();
  const { data: readIds = [] } = useQuery({
    ...sidebarStateQuery,
    select: (rows) => {
      const unread = new Set(
        rows.filter((row) => isUnread(row)).map((row) => row.roomId)
      );
      return roomIds.filter((roomId) => !unread.has(roomId));
    },
  });

  return (
    <>
      <DropdownMenuItem onClick={() => void setCompose(true)}>
        <IconEdit />
        New message
      </DropdownMenuItem>
      <DropdownMenuItem render={<Link href="/dms" />}>
        <IconMessage />
        Open all direct messages
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={readIds.length === 0}
        onClick={() => close({ roomIds: readIds })}
      >
        <IconX />
        Close read conversations
      </DropdownMenuItem>
    </>
  );
}
