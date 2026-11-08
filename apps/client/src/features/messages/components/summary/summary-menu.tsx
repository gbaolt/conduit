'use client';

import { Button } from '@conduit/ui/components/button';
import { Calendar } from '@conduit/ui/components/calendar';
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
import { Field, FieldLabel } from '@conduit/ui/components/field';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@conduit/ui/components/popover';
import { IconCalendar, IconDots, IconSparkles } from '@tabler/icons-react';
import { addDays, format, isToday, startOfDay, subDays } from 'date-fns';
import { useState } from 'react';
import type { Matcher } from 'react-day-picker';

import { useAiSettings } from '@/services/workspaces/hooks';

import { useSummary } from '../../context/summary';

const HOUR_MS = 60 * 60 * 1000;

/** Nothing offers a summary until the workspace's setting has loaded and says AI is on. */
function useCanSummarize() {
  const { data } = useAiSettings();
  const summary = useSummary();
  return summary !== null && data?.aiEnabled === true ? summary : null;
}

/** The thread header's menu. It renders nothing while AI is off, so the thread has no empty menu. */
export function SummaryThreadMenu() {
  const summary = useCanSummarize();
  if (!summary) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
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
export function SummaryChannelItems({ isDm }: { isDm: boolean }) {
  const summary = useCanSummarize();
  if (!summary) return null;

  const since = (hours: number) =>
    void summary.summarize({ from: new Date(Date.now() - hours * HOUR_MS) });

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
            Pick dates…
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
}

/** One day, picked from a calendar in a popover. */
function DatePicker({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: Date;
  onChange: (day: Date) => void;
  disabled: Matcher[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            className="justify-start font-normal"
          />
        }
      >
        <IconCalendar data-icon="inline-start" />
        {format(value, 'PPP')}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          required
          selected={value}
          defaultMonth={value}
          disabled={disabled}
          onSelect={(day) => {
            onChange(day);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Asks for the first and last day to summarize. Opened by the menu's "Pick dates…". */
export function SummarySinceDialog() {
  const summary = useSummary();
  const [today] = useState(() => startOfDay(new Date()));
  const [start, setStart] = useState(() => subDays(today, 7));
  const [end, setEnd] = useState(today);

  if (!summary) return null;

  return (
    <Dialog open={summary.pickingDate} onOpenChange={summary.setPickingDate}>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            summary.setPickingDate(false);
            // Days start at midnight in the member's own zone. A range that ends today runs until now.
            void summary.summarize({
              from: startOfDay(start),
              to: isToday(end) ? undefined : addDays(startOfDay(end), 1),
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Summarize a date range</DialogTitle>
            <DialogDescription>
              Summarizes the newest messages from the start date through the end
              date.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="summary-start">Start date</FieldLabel>
              <DatePicker
                id="summary-start"
                value={start}
                onChange={setStart}
                disabled={[{ after: end }]}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="summary-end">End date</FieldLabel>
              <DatePicker
                id="summary-end"
                value={end}
                onChange={setEnd}
                disabled={[{ before: start }, { after: today }]}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="submit">Summarize</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
