'use client';

import type { Message as MessageData } from '@conduit/contract';
import { Message } from '@conduit/ui/components/message';
import { cn } from '@conduit/ui/lib/utils';
import type { ReactNode } from 'react';

import { useHold } from '../../hooks/use-hold';
import {
  type Author,
  MessageAuthor,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageTime,
} from './message';
import { MessageMarkdown } from './message-markdown';

const sentFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** A message shown outside its conversation, as in the pinned list and the Saved page. */
export function MessageExcerpt({
  message,
  author,
  context,
  highlight,
  children,
  className,
}: {
  message: Pick<MessageData, 'id' | 'body' | 'createdAt' | 'updatedAt'>;
  author: Author | null;
  /** Where the message was sent, above the author line. */
  context?: ReactNode;
  /** Search terms to mark in the body. */
  highlight?: readonly string[];
  /** Controls at the end of the excerpt. With them, a press and hold on a touch screen shows them. */
  children?: ReactNode;
  className?: string;
}) {
  const hold = useHold<HTMLDivElement>();
  return (
    <Message
      {...(children && hold)}
      variant="log"
      role="article"
      className={cn(
        children &&
          'data-held:bg-muted dark:data-held:bg-muted/50 pointer-coarse:select-none pointer-coarse:[-webkit-touch-callout:none]',
        className
      )}
    >
      <MessageAvatar author={author} />
      <MessageContent>
        {context}
        <MessageHeader>
          <MessageAuthor author={author} />
          <MessageTime
            date={message.createdAt}
            format={sentFormat}
            className="text-xs"
          />
        </MessageHeader>
        <MessageMarkdown
          id={message.id}
          updatedAt={message.updatedAt}
          body={message.body}
          highlight={highlight}
        />
        {children}
      </MessageContent>
    </Message>
  );
}
