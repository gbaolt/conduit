'use client';

import { Button } from '@conduit/ui/components/button';
import { cn } from '@conduit/ui/lib/utils';
import { useEffect, useState } from 'react';

import type { PendingMessage } from '@/services/messages/hooks';

import { MessageMarkdown } from '../../lib/markdown/message-markdown';
import {
  type Author,
  Message,
  MessageAuthor,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from './message';

const SENDING_LABEL_MS = 3000;

/** A message the member sent that the server has not stored yet. */
export function MessagePending({
  pending,
  author,
  grouped,
  onRetry,
  onDiscard,
}: {
  pending: PendingMessage;
  author: Author;
  grouped: boolean;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const failed = pending.status === 'failed';
  const slow = useSlowSend(pending.status === 'sending');

  return (
    <Message
      label={`${author.name}, ${failed ? 'not sent' : 'sending'}`}
      createdAt={pending.createdAt}
      grouped={grouped}
    >
      <MessageAvatar author={author} />
      <MessageContent className="pb-0.5">
        <MessageHeader>
          <MessageAuthor>{author.name}</MessageAuthor>
          {(failed || slow) && (
            <span
              className={cn(
                'text-xs',
                failed ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {failed ? 'Not sent.' : 'Sending…'}
            </span>
          )}
        </MessageHeader>
        <MessageMarkdown
          id={pending.clientId}
          updatedAt={pending.createdAt}
          body={pending.body}
        />
        {failed && (
          <p className="flex gap-1">
            <Button variant="link" size="xs" onClick={onRetry}>
              Retry
            </Button>
            <Button variant="link" size="xs" onClick={onDiscard}>
              Delete
            </Button>
          </p>
        )}
      </MessageContent>
    </Message>
  );
}

/** True once a send has run longer than the quiet window, so a fast send never flashes a label. */
function useSlowSend(sending: boolean) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!sending) return;
    const timer = setTimeout(() => setSlow(true), SENDING_LABEL_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [sending]);

  return slow;
}
