import type { Message } from '@conduit/contract';
import type { ReactNode } from 'react';

import { UserAvatar } from '@/components/nav-user';

import { MessageMarkdown } from '../lib/markdown/message-markdown';
import type { Author } from './message-row';

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
  message: Message;
  author: Author;
  /** Where the message was sent, above the author line. */
  context?: ReactNode;
  /** Controls at the end of the excerpt. */
  children?: ReactNode;
}) {
  return (
    <article className="flex gap-3">
      <UserAvatar
        name={author.name}
        image={author.image}
        className="size-9 shrink-0 rounded-md"
      />
      <div className="min-w-0 flex-1">
        {context}
        <p className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{author.name}</span>
          <time
            dateTime={message.createdAt.toISOString()}
            className="text-muted-foreground text-xs tabular-nums"
          >
            {sentFormat.format(message.createdAt)}
          </time>
        </p>
        <MessageMarkdown
          id={message.id}
          updatedAt={message.updatedAt}
          body={message.body}
        />
        {children}
      </div>
    </article>
  );
}
