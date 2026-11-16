'use client';

import { Button } from '@conduit/ui/components/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@conduit/ui/components/empty';
import { IconCloudOff } from '@tabler/icons-react';

/** Keeps the app's rail when a page fails, instead of Next's full-page error. */
export default function DashboardError({ retry }: { retry: () => void }) {
  return (
    <Empty className="h-full border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconCloudOff />
        </EmptyMedia>
        <EmptyTitle>Couldn’t load this page</EmptyTitle>
        <EmptyDescription>
          Nothing is lost. Try again in a moment.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" onClick={retry}>
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  );
}
