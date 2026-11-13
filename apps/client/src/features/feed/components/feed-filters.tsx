'use client';

import type { FeedFilter } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@conduit/ui/components/toggle-group';
import type { ReactNode } from 'react';

/** The All and Unread toggle, then `children` such as the sort, with Mark all read at the far end. */
export function FeedFilters({
  filter,
  onFilterChange,
  canMarkAllRead,
  onMarkAllRead,
  children,
}: {
  children?: ReactNode;
  filter: FeedFilter;
  onFilterChange: (filter: FeedFilter) => void;
  canMarkAllRead: boolean;
  onMarkAllRead: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        aria-label="Show"
        variant="outline"
        size="sm"
        spacing={0}
        value={[filter]}
        onValueChange={([next]) => {
          // A toggle group lets the pressed item be pressed off, and one filter always stays on.
          if (next) onFilterChange(next as FeedFilter);
        }}
      >
        <ToggleGroupItem value="all">All</ToggleGroupItem>
        <ToggleGroupItem value="unread">Unread</ToggleGroupItem>
      </ToggleGroup>
      {children}
      <Button
        variant="ghost"
        size="sm"
        className="ml-auto"
        disabled={!canMarkAllRead}
        onClick={onMarkAllRead}
      >
        Mark all read
      </Button>
    </div>
  );
}
