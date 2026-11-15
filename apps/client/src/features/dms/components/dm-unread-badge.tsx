'use client';

import { useParams } from 'next/navigation';

import { RailLinkBadge } from '@/components/rail-link';
import { useUnreadDmCount } from '@/services/dms/hooks';

/** How many DMs have unread messages, on the rail's DMs icon. The open DM is being read, so it never counts. */
export function DmUnreadBadge() {
  const { roomId } = useParams<{ roomId?: string }>();
  return <RailLinkBadge count={useUnreadDmCount(roomId)} />;
}
