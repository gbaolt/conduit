import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
} from '@conduit/ui/components/sidebar';
import { Skeleton } from '@conduit/ui/components/skeleton';

// Fixed widths: a random width would differ between the server and the client render.
const CHANNEL_WIDTHS = ['w-24', 'w-28', 'w-20'];

/** Stands in for `ChannelGroups`: the Channels label row and three 32px channel rows. */
export function ChannelGroupsSkeleton() {
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
