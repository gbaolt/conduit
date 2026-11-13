'use client';

import { Button } from '@conduit/ui/components/button';
import { IconSparkles } from '@tabler/icons-react';

import { SummaryCard } from '@/features/messages/components/summary/summary-card';
import {
  SummaryProvider,
  useSummary,
} from '@/features/messages/context/summary';
import { useHasUnreadRooms } from '@/services/activity/hooks';
import { useFeedUnreadCount } from '@/services/feed/hooks';
import { useAiSettings } from '@/services/workspaces/hooks';

function CatchMeUpButton() {
  const summary = useSummary();
  const unreadRooms = useHasUnreadRooms();
  const unreadItems = useFeedUnreadCount();
  const hasUnread = unreadRooms || unreadItems > 0;
  if (!summary) return null;

  const running = summary.state.status === 'streaming';

  return (
    <Button
      variant="outline"
      size="sm"
      className="pointer-coarse:min-h-11"
      disabled={!hasUnread || running}
      onClick={() => void summary.summarize()}
    >
      <IconSparkles />
      {hasUnread ? 'Catch me up' : "You're all caught up"}
    </Button>
  );
}

/** Summarizes everything the member has not read, above the feed. It marks nothing read, and it is gone while AI is off. */
export function CatchMeUp() {
  const { data } = useAiSettings();
  if (data?.aiEnabled !== true) return null;

  return (
    <SummaryProvider target={{ kind: 'catch-up' }}>
      <div className="mb-3 max-w-2xl">
        <CatchMeUpButton />
      </div>
      <div className="max-w-2xl">
        <SummaryCard />
      </div>
    </SummaryProvider>
  );
}
