'use client';

import { Tabs, TabsList, TabsTrigger } from '@conduit/ui/components/tabs';
import { useQueryStates } from 'nuqs';
import type { ReactNode } from 'react';

import { feedParams } from '../lib/feed-params';
import type { FeedView } from '../lib/feed-views';

/**
 * A tab per view. Choosing one writes its sources to `?show=`. No tab is active while the sources match no
 * view, and `children`, the search and the filter, sit at the end of the row.
 */
export function FeedViewTabs({
  views,
  active,
  children,
}: {
  views: readonly FeedView[];
  active: FeedView | undefined;
  children?: ReactNode;
}) {
  const [, setParams] = useQueryStates(feedParams);

  return (
    <div className="flex items-center gap-2">
      <Tabs
        value={active?.id ?? null}
        onValueChange={(id) => {
          const view = views.find((v) => v.id === id);
          if (view) void setParams({ show: view.sources });
        }}
        className="min-w-0 flex-1"
      >
        <TabsList
          variant="line"
          aria-label="Views"
          className="-mb-px h-11 max-w-full [scrollbar-width:none] justify-start overflow-x-auto overflow-y-hidden"
        >
          {views.map((view) => (
            <TabsTrigger
              key={view.id}
              value={view.id}
              className="-mb-1 h-full flex-none px-2 after:bottom-0!"
            >
              {view.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="mb-1 flex shrink-0 items-center gap-1">{children}</div>
    </div>
  );
}
