import type { Message as MessageData } from '@conduit/contract';
import { Message } from '@conduit/ui/components/message';
import type { ReactNode } from 'react';

import { MessageMarkdown } from '../../lib/markdown/message-markdown';
import {
  type Author,
  MessageAuthor,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageTime,
} from './message';

const sentFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** A message shown outside its conversation, as in the pinned list and the Saved page. */
export function MessageExcerpt({
  message,
  author,
  context,
  children,
}: {
  message: MessageData;
  author: Author;
  /** Where the message was sent, above the author line. */
  context?: ReactNode;
  /** Controls at the end of the excerpt. */
  children?: ReactNode;
}) {
  return (
    <Message variant="log" role="article">
      <MessageAvatar author={author} />
      <MessageContent>
        {context}
        <MessageHeader>
          <MessageAuthor>{author.name}</MessageAuthor>
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
        />
        {children}
      </MessageContent>
    </Message>
  );
}
