import type { Message as MessageData } from '@conduit/contract';
import { Message } from '@conduit/ui/components/message';
import type { ReactNode } from 'react';

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
  /** Controls at the end of the excerpt. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Message variant="log" role="article" className={className}>
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
