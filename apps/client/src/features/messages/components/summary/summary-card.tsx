'use client';

import { citedSourceIds, type SummaryBullet } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { format, isToday } from 'date-fns';

import { cn } from '@/lib/utils';
import type { SummaryState } from '@/services/messages/summaries';

import { useSummary } from '../../context/summary';
import { SummarySinceDialog } from './summary-menu';
import { SummarySource } from './summary-source';

const noop = () => undefined;

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
    <ul className="mt-2 list-disc space-y-2 pl-5">
      {bullets.map((bullet, index) => (
        <li key={index} className="text-sm leading-[22px]">
          {bullet.text}{' '}
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
        <li className="text-muted-foreground list-none text-sm">
          Reading the messages
          {caret}
        </li>
      )}
    </ul>
  );
}

/** "Since 9:12 AM", or "Since Fri 9:12 AM" when the oldest unread message is older than today. */
const since = (from: Date) =>
  `Since ${format(from, isToday(from) ? 'p' : 'EEE p')}`;

function heading(state: SummaryState, catchUp: boolean) {
  let count = 0;
  if (state.status === 'streaming') count = state.messageCount;
  if (state.status === 'done') count = state.summary.messageCount;
  if (catchUp) {
    return state.status === 'done' && state.summary.from
      ? since(state.summary.from)
      : 'Catching you up';
  }
  if (count === 0) return 'Summary';
  return `Summary of ${count} ${count === 1 ? 'message' : 'messages'}`;
}

/**
 * The summary of this conversation or thread, at the end of its log. Only the requester sees it until they
 * share it. `onSource` scrolls the log to a cited message. A catch-up sits above the feed, cannot be shared,
 * and links each source to its own room.
 */
export function SummaryCard({
  shareLabel = '',
  canShare = false,
  onSource = noop,
}: {
  shareLabel?: string;
  canShare?: boolean;
  onSource?: (messageId: string) => void;
}) {
  const summary = useSummary();
  if (!summary) return null;

  const { state, share, dismiss, retry } = summary;
  const catchUp = summary.target.kind === 'catch-up';
  const dialog =
    summary.target.kind === 'channel' ? <SummarySinceDialog /> : null;
  if (state.status === 'idle') return dialog;

  return (
    <>
      <section
        aria-label="Summary"
        aria-busy={state.status === 'streaming'}
        className={cn(
          'bg-primary/[0.06] rounded-md px-4 py-3',
          catchUp ? 'mb-3' : 'mx-5 my-3 max-w-[72ch]'
        )}
      >
        {state.status === 'error' ? (
          <>
            <p role="alert" className="text-sm">
              {state.code === 'AI_UNAVAILABLE' || state.code === null
                ? 'AI is unavailable right now.'
                : state.message}
            </p>
            <div className="mt-2 flex gap-1">
              {state.code !== 'NOTHING_TO_SUMMARIZE' &&
                state.code !== 'AI_DISABLED' && (
                  <Button variant="link" size="xs" onClick={retry}>
                    Retry
                  </Button>
                )}
              <Button variant="ghost" size="xs" onClick={dismiss}>
                Dismiss
              </Button>
            </div>
          </>
        ) : (
          <>
            <header className="flex flex-wrap items-baseline gap-x-2">
              <h3 className="text-sm font-semibold">
                {heading(state, catchUp)}
              </h3>
              <p className="text-muted-foreground text-xs">
                Only you can see this
              </p>
            </header>
            <Bullets
              bullets={
                state.status === 'done' ? state.summary.bullets : state.bullets
              }
              streaming={state.status === 'streaming'}
              catchUp={catchUp}
              onSource={onSource}
            />
            <div className="mt-3 flex items-center gap-1">
              {state.status === 'streaming' ? (
                <Button variant="secondary" size="xs" onClick={dismiss}>
                  Stop
                </Button>
              ) : (
                <>
                  {!catchUp && (
                    <Button
                      variant="secondary"
                      size="xs"
                      disabled={!canShare || share.isPending}
                      onClick={() => share.mutate(state.summary.id)}
                    >
                      {shareLabel}
                    </Button>
                  )}
                  <Button variant="ghost" size="xs" onClick={dismiss}>
                    Dismiss
                  </Button>
                </>
              )}
            </div>
            {share.isError && (
              <p role="alert" className="text-destructive mt-2 text-xs">
                Couldn&apos;t share. {share.error.message}
              </p>
            )}
          </>
        )}
      </section>
      {dialog}
    </>
  );
}
