import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
} from '@conduit/ui/components/sidebar';
import { Skeleton } from '@conduit/ui/components/skeleton';

import { ConversationSkeleton } from '@/components/conversation-skeleton';

// Fixed widths: a random width would differ between the server and the client render.
const CHANNEL_WIDTHS = ['w-24', 'w-28', 'w-20'];

/** Stands in for `ChannelList`: the Channels label row and three 32px channel rows. */
export function ChannelListSkeleton() {
  return (
    <SidebarGroup aria-hidden>
      <div className="mb-1 flex h-8 items-center gap-1 px-2">
        <Skeleton className="size-4" />
        <Skeleton className="h-3 w-16" />
      </div>
      <SidebarMenu>
        {CHANNEL_WIDTHS.map((width) => (
          <SidebarMenuItem
            key={width}
            className="flex h-8 items-center gap-2 px-2"
          >
            <Skeleton className="size-4" />
            <Skeleton className={`h-4 ${width}`} />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

/** Stands in for the `ChannelHeader` bar: the 48px header. */
export function ChannelHeaderSkeleton() {
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

/** Stands in for the whole channel page while its sidebar loads: the header and the log. */
export function ChannelPageSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading channel"
      className="flex h-full flex-col"
    >
      <ChannelHeaderSkeleton />
      <ConversationSkeleton />
    </div>
  );
}
