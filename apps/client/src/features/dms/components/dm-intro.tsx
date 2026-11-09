'use client';

import { useQuery } from '@tanstack/react-query';

import { UserAvatar } from '@/components/user-avatar';
import { sessionQuery } from '@/services/auth/queries';
import { dmTitle } from '@/services/dms/dm-title';
import { useDm } from '@/services/dms/hooks';

/** The first thing in a DM's log, above its first message. */
export function DmIntro({ roomId }: { roomId: string }) {
  const dm = useDm(roomId);
  const { data: session } = useQuery(sessionQuery);

  if (!dm) return null;
  const viewerId = session?.user.id ?? '';
  const isSelf = dm.members.length === 1;
  const others = isSelf
    ? dm.members
    : dm.members.filter((member) => member.userId !== viewerId);

  return (
    <section className="px-5 pt-6 pb-4">
      <div className="flex -space-x-2">
        {others.map((member) => (
          <UserAvatar
            key={member.userId}
            name={member.name}
            image={member.image}
            className="ring-background size-12 rounded-md ring-2"
          />
        ))}
      </div>
      <h2 className="mt-3 text-xl font-semibold">{dmTitle(dm, viewerId)}</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        {isSelf
          ? 'Jot notes, drafts, and links here. Only you can see them.'
          : 'This is the start of your conversation.'}
      </p>
    </section>
  );
}
