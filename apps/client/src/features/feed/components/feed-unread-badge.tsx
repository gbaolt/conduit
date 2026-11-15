'use client';

import { RailLinkBadge } from '@/components/rail-link';
import { useFeedUnreadCount } from '@/services/feed/hooks';

/** The unread Activity count on the rail icon. */
export function FeedUnreadBadge() {
  return <RailLinkBadge count={useFeedUnreadCount()} />;
}
