'use client';

import { useFeedUnreadCount } from '@/services/feed/hooks';

const BADGE_MAX = 99;

/** The unread Activity count on the rail icon, capped at "99+". It renders nothing at zero. */
export function FeedUnreadBadge() {
  const count = useFeedUnreadCount();
  if (count === 0) return null;

  return (
    <>
      <span className="sr-only">, {count} unread</span>
      <span
        aria-hidden
        className="bg-primary text-primary-foreground absolute top-0 left-1/2 ml-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-medium tabular-nums"
      >
        {count > BADGE_MAX ? `${BADGE_MAX}+` : count}
      </span>
    </>
  );
}
