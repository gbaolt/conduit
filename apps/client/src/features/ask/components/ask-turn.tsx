'use client';

import type { Answer } from '@conduit/contract';
import { AILoader } from '@conduit/ui/components/ai-loader';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@conduit/ui/components/alert';
import { Bubble, BubbleContent } from '@conduit/ui/components/bubble';
import { Button } from '@conduit/ui/components/button';
import {
  Message,
  MessageContent,
  MessageFooter,
} from '@conduit/ui/components/message';
import { IconAlertTriangle, IconSearchOff } from '@tabler/icons-react';

import { CopyButton } from '@/components/copy-button';
import type { AskTurn } from '@/services/ask/hooks';

import { AskAnswer } from './ask-answer';
import { AskSources } from './ask-sources';

/** A stored answer, or the question still in flight. */
export type AskTurnView = AskTurn | (Answer & { status: 'done' });

const CITATIONS = / ?\[\d+\]/g;

function NotFound() {
  return (
    <p className="text-muted-foreground flex gap-2 text-sm">
      <IconSearchOff aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        I couldn&apos;t find that in what you can access. Try other words, or
        ask in the conversation where it came up.
      </span>
    </p>
  );
}

function Searching() {
  return (
    <div
      role="status"
      className="text-muted-foreground flex items-center text-sm"
    >
      <span aria-hidden className="flex w-5 shrink-0">
        <AILoader dotSize={2} />
      </span>
      <span className="shimmer motion-reduce:shimmer-none">
        Searching what you can access…
      </span>
    </div>
  );
}

function TurnAnswer({
  turn,
  latest,
  onOpenSource,
  onRetry,
  onNewChat,
}: {
  turn: AskTurnView;
  latest: boolean;
  onOpenSource: () => void;
  onRetry: () => void;
  onNewChat: () => void;
}) {
  if (turn.status === 'failed') {
    const full = turn.code === 'CHAT_FULL';
    return (
      <Alert variant="destructive">
        <IconAlertTriangle />
        <AlertTitle>Couldn&apos;t answer</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          {turn.code === 'AI_UNAVAILABLE' || turn.code === null
            ? 'AI is unavailable right now. Try again in a moment.'
            : turn.message}
          {turn.code !== 'AI_DISABLED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={full ? onNewChat : onRetry}
            >
              {full ? 'New chat' : 'Retry'}
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }
  if (!turn.found) return <NotFound />;
  if (!turn.body) {
    return turn.status === 'streaming' ? <Searching /> : null;
  }

  const streaming = turn.status === 'streaming';
  return (
    <>
      <AskAnswer
        body={turn.body}
        sources={turn.sources}
        streaming={streaming}
        onOpen={onOpenSource}
      />
      {!streaming && (
        <AskSources
          // Remounts when a newer turn arrives, so the older one closes its sources.
          key={String(latest)}
          sources={turn.sources}
          defaultOpen={latest}
          onOpen={onOpenSource}
        />
      )}
      {turn.status === 'stopped' && (
        <p className="text-muted-foreground text-xs">
          Stopped. The full answer shows the next time this chat opens.
        </p>
      )}
      {turn.status === 'done' && (
        <MessageFooter className="px-0">
          <CopyButton
            variant="ghost"
            size="icon-sm"
            text={() => turn.body.replace(CITATIONS, '')}
          />
        </MessageFooter>
      )}
    </>
  );
}

/** One question in a bubble, then its answer, its not-found note, or why it failed. */
export function AskTurnItem(props: {
  turn: AskTurnView;
  /** The newest turn opens its sources. */
  latest: boolean;
  onOpenSource: () => void;
  onRetry: () => void;
  onNewChat: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Message align="end">
        <MessageContent>
          <Bubble align="end" variant="muted">
            <BubbleContent className="whitespace-pre-wrap">
              {props.turn.question}
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
      <Message align="start">
        <MessageContent>
          <TurnAnswer {...props} />
        </MessageContent>
      </Message>
    </div>
  );
}
