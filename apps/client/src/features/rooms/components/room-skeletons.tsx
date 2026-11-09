import { Skeleton } from '@conduit/ui/components/skeleton';

import {
  ConversationComposerSkeleton,
  ConversationSkeleton,
} from '@/components/conversation-skeleton';

/** Stands in for the `ChannelHeader` bar: the 48px header. */
export function RoomHeaderSkeleton() {
  return (
    <div className="flex min-h-12 shrink-0 items-center gap-1.5 border-b px-4 py-1.5">
      <div className="min-w-0 flex-1">
        <Skeleton className="h-7 w-24 rounded-md" />
      </div>
      <Skeleton className="h-7 w-10 rounded-md" />
      <Skeleton className="size-7 rounded-md" />
    </div>
  );
}

/** Stands in for the whole channel page while it loads: the header, the log, and the composer. */
export function RoomPageSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading channel"
      className="flex h-full flex-col"
    >
      <RoomHeaderSkeleton />
      <ConversationSkeleton />
      <div className="px-4 pb-4 sm:px-5">
        <ConversationComposerSkeleton />
      </div>
    </div>
  );
}
