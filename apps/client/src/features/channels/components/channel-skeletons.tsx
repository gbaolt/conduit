import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
} from '@conduit/ui/components/sidebar';
import { Skeleton } from '@conduit/ui/components/skeleton';

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

/** Stands in for `ChannelHeader`: the 48px header and the intro line under it. */
export function ChannelPageSkeleton() {
  return (
    <div role="status" aria-label="Loading channel">
      <div className="flex min-h-12 items-center gap-1.5 border-b px-4 py-1.5">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-7 w-24 rounded-md" />
        </div>
        <Skeleton className="h-7 w-10 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
      </div>
      <div className="flex h-13 items-center px-4">
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  );
}
