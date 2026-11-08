'use client';

import { Button } from '@conduit/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@conduit/ui/components/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import { Input } from '@conduit/ui/components/input';
import { Label } from '@conduit/ui/components/label';
import { IconDots, IconSparkles } from '@tabler/icons-react';
import { useState } from 'react';

import { useAiSettings } from '@/services/workspaces/hooks';

import { useSummary } from '../context/summary';

const HOUR_MS = 60 * 60 * 1000;

/** Nothing offers a summary until the workspace's setting has loaded and says AI is on. */
function useCanSummarize() {
  const { data } = useAiSettings();
  const summary = useSummary();
  return summary !== null && data?.aiEnabled === true ? summary : null;
}

/** The thread header's menu. It renders nothing while AI is off, so the thread has no empty menu. */
export function ThreadSummaryMenu() {
  const summary = useCanSummarize();
  if (!summary) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Thread actions"
            className="pointer-coarse:size-11"
          />
        }
      >
        <IconDots />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => void summary.summarize()}>
          <IconSparkles />
          Summarize this thread
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Rows for a channel or DM header's menu: Summarize channel and its range. Nothing while AI is off. */
export function SummarizeChannelItems({ isDm }: { isDm: boolean }) {
  const summary = useCanSummarize();
  if (!summary) return null;

  const since = (hours: number) =>
    void summary.summarize(new Date(Date.now() - hours * HOUR_MS));

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <IconSparkles />
          {isDm ? 'Summarize conversation' : 'Summarize channel'}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-44">
          <DropdownMenuItem onClick={() => since(24)}>
            Last 24 hours
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => since(24 * 7)}>
            Last 7 days
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => summary.setPickingDate(true)}>
            Since a date…
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
}

const toDateInput = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Asks which day to summarize from. Opened by the menu's "Since a date…". */
export function SummarizeSinceDialog() {
  const summary = useSummary();
  const today = toDateInput(new Date());
  const [day, setDay] = useState(today);

  if (!summary) return null;

  return (
    <Dialog open={summary.pickingDate} onOpenChange={summary.setPickingDate}>
      <DialogContent className="sm:max-w-sm">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            summary.setPickingDate(false);
            // A date input holds a calendar day, which starts at midnight in the member's own zone.
            void summary.summarize(new Date(`${day}T00:00:00`));
          }}
        >
          <DialogHeader>
            <DialogTitle>Summarize since a date</DialogTitle>
            <DialogDescription>
              Summarizes the newest messages from that day until now.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="summary-since">From</Label>
            <Input
              id="summary-since"
              type="date"
              required
              max={today}
              value={day}
              onChange={(event) => setDay(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!day}>
              Summarize
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
