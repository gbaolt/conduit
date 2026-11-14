'use client';

import { citedSourceIds, type SummaryBullet } from '@conduit/contract';
import { AILoader } from '@conduit/ui/components/ai-loader';
import { Button } from '@conduit/ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@conduit/ui/components/dialog';
import { format, isToday } from 'date-fns';
import { useState } from 'react';
import type { Components } from 'react-markdown';

import { Markdown } from '@/components/markdown';
import type { SummaryState } from '@/services/messages/summaries';

import { useSummary } from '../../context/summary';
import { SummarySinceDialog } from './summary-menu';
import { SummarySource } from './summary-source';

const noop = () => undefined;

const inline: Components = { p: ({ children }) => <>{children}</> };

function Sources({
  ids,
  order,
  catchUp,
  onSource,
}: {
  ids: readonly string[];
  order: readonly string[];
  catchUp: boolean;
  onSource: (messageId: string) => void;
}) {
  return ids.map((id) => {
    const number = order.indexOf(id) + 1;
    if (catchUp)
      return <SummarySource key={id} messageId={id} number={number} />;

    return (
      <Button
        key={id}
        size="xs"
        variant="link"
        type="button"
        aria-label={`Source ${number}`}
        className="pointer-coarse:inline-block pointer-coarse:min-h-11 pointer-coarse:min-w-6"
        onClick={() => onSource(id)}
      >
        {number}
      </Button>
    );
  });
}

function Bullets({
  bullets,
  streaming,
  catchUp,
  onSource,
}: {
  bullets: readonly SummaryBullet[];
  streaming: boolean;
  catchUp: boolean;
  onSource: (messageId: string) => void;
}) {
  const order = citedSourceIds(bullets);
  const caret = (
    <span
      aria-hidden
      className="bg-foreground ml-0.5 inline-block h-4 w-px animate-pulse align-middle motion-reduce:animate-none"
    />
  );

  return (
    <ul className="list-disc space-y-2 pl-5">
      {bullets.map((bullet, index) => (
        <li key={index} className="text-sm leading-[22px]">
          <Markdown className="typeset-chat inline" components={inline}>
            {bullet.text}
          </Markdown>{' '}
          <Sources
            ids={bullet.sourceIds}
            order={order}
            catchUp={catchUp}
            onSource={onSource}
          />
          {streaming && index === bullets.length - 1 && caret}
        </li>
      ))}
      {streaming && bullets.length === 0 && (
        <li className="text-muted-foreground -ml-5 flex list-none items-center text-sm">
          <span aria-hidden className="flex w-5 shrink-0">
            <AILoader dotSize={2} />
          </span>
          <span className="shimmer motion-reduce:shimmer-none">
            Reading the messages
          </span>
        </li>
      )}
    </ul>
  );
}

/** "since 9:12 AM", or "since Fri 9:12 AM" when the oldest unread message is older than today. */
const since = (from: Date) =>
  `since ${format(from, isToday(from) ? 'p' : 'EEE p')}`;

function description(state: SummaryState) {
  if (state.status !== 'error') return 'Only you can see this.';
  return state.code === 'AI_UNAVAILABLE' || state.code === null
    ? 'AI is unavailable right now.'
    : state.message;
}

function heading(state: SummaryState, catchUp: boolean) {
  if (state.status === 'error') return "Couldn't summarize";
  let count = 0;
  if (state.status === 'streaming') count = state.messageCount;
  if (state.status === 'done') count = state.summary.messageCount;
  if (catchUp) {
    return state.status === 'done' && state.summary.from
      ? `What you missed ${since(state.summary.from)}`
      : 'Catching you up';
  }
  if (count === 0) return 'Summary';
  return `Summary of ${count} ${count === 1 ? 'message' : 'messages'}`;
}

/**
 * The summary of this conversation or thread, or a catch-up, in a dialog that opens when it starts and
 * stops it when closed. Only the requester sees it until they share it. `onSource` closes the dialog and
 * scrolls the log to a cited message. A catch-up cannot be shared, and links each source to its own room.
 */
export function SummaryDialog({
  shareLabel = '',
  canShare = false,
  onSource = noop,
}: {
  shareLabel?: string;
  canShare?: boolean;
  onSource?: (messageId: string) => void;
}) {
  const summary = useSummary();
  // The last state with content, so the dialog keeps it on screen while it animates closed.
  const [shown, setShown] = useState<SummaryState>({ status: 'idle' });
  if (summary && summary.state.status !== 'idle' && summary.state !== shown) {
    setShown(summary.state);
  }
  if (!summary) return null;

  const { share, dismiss, retry } = summary;
  const state = shown;
  const catchUp = summary.target.kind === 'catch-up';
  const streaming = state.status === 'streaming';

  return (
    <>
      <Dialog
        open={summary.state.status !== 'idle'}
        onOpenChange={(open) => {
          if (!open) dismiss();
        }}
      >
        {/* Pinned to the top, so the text being read stays put while the summary streams in below it. */}
        <DialogContent
          className="top-[10svh] translate-y-0 sm:max-w-lg"
          aria-busy={streaming}
        >
          <DialogHeader>
            <DialogTitle>{heading(state, catchUp)}</DialogTitle>
            <DialogDescription>{description(state)}</DialogDescription>
          </DialogHeader>
          {state.status !== 'error' && state.status !== 'idle' && (
            <div className="-mx-4 max-h-[60svh] overflow-y-auto px-4">
              <Bullets
                bullets={
                  state.status === 'done'
                    ? state.summary.bullets
                    : state.bullets
                }
                streaming={streaming}
                catchUp={catchUp}
                onSource={(id) => {
                  dismiss();
                  onSource(id);
                }}
              />
            </div>
          )}
          {share.isError && (
            <p role="alert" className="text-destructive text-sm">
              Couldn&apos;t share. {share.error.message}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {streaming ? 'Stop' : 'Close'}
            </DialogClose>
            {state.status === 'error' &&
              state.code !== 'NOTHING_TO_SUMMARIZE' &&
              state.code !== 'AI_DISABLED' && (
                <Button onClick={retry}>Retry</Button>
              )}
            {state.status === 'done' && !catchUp && (
              <Button
                disabled={!canShare || share.isPending}
                onClick={() => share.mutate(state.summary.id)}
              >
                {shareLabel}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {summary.target.kind === 'channel' && <SummarySinceDialog />}
    </>
  );
}
