'use client';

import { cn } from '@conduit/ui/lib/utils';

import { usePresenceStatus } from '@/services/activity/hooks';

const LABEL = { online: 'Online', away: 'Away' } as const;

/**
 * An 8 px dot for a member's presence: filled green when online, a hollow ring when away.
 * Position it over the avatar's bottom right corner with `className`. `@conduit/ui/components/status`
 * does not fit, since it animates a ping and has no away state.
 */
export function PresenceDot({
  userId,
  className,
}: {
  userId: string;
  className?: string;
}) {
  const status = usePresenceStatus(userId);

  return (
    <span
      role="img"
      aria-label={LABEL[status]}
      className={cn(
        'ring-background box-border block size-2 rounded-full ring-2',
        status === 'online'
          ? 'bg-emerald-500'
          : 'border-muted-foreground bg-background border-[1.5px]',
        className
      )}
    />
  );
}
