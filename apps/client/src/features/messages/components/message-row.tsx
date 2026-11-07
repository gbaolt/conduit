'use client';

import type { LinkPreview, Message } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { cn } from '@conduit/ui/lib/utils';
import { IconPin } from '@tabler/icons-react';
import { type ReactNode, useEffect, useState } from 'react';

import { UserAvatar } from '@/components/nav-user';
import {
  type PendingMessage,
  useEditMessage,
  useRemoveLinkPreview,
} from '@/services/messages/hooks';

import { MessageMarkdown } from '../lib/markdown/message-markdown';
import { Composer } from './composer';
import { LinkPreviewCard } from './link-preview-card';
import { MessageActions } from './message-actions';
import { ReactionBar } from './reaction-bar';

export type Author = { name: string; image: string | null };

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});
const fullFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'full',
  timeStyle: 'medium',
});

const SENDING_LABEL_MS = 3000;

function Time({ date, className }: { date: Date; className?: string }) {
  return (
    <time
      dateTime={date.toISOString()}
      title={fullFormat.format(date)}
      className={cn('text-muted-foreground tabular-nums', className)}
    >
      {timeFormat.format(date)}
    </time>
  );
}

/** The row's frame: the avatar column, the name line, and the hover treatment. */
function RowFrame({
  label,
  author,
  createdAt,
  grouped,
  highlight,
  fresh,
  trailing,
  actions,
  children,
}: {
  label: string;
  author: Author;
  createdAt: Date;
  grouped: boolean;
  highlight?: boolean;
  fresh?: boolean;
  trailing?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article
      aria-label={label}
      data-message-row=""
      tabIndex={-1}
      className={cn(
        'group/row hover:bg-muted focus-visible:bg-muted relative flex gap-3 px-5 outline-none',
        grouped ? 'pt-0.5' : 'pt-2',
        highlight &&
          'bg-primary/[0.06] shadow-[inset_2px_0_0_var(--color-primary)]',
        fresh &&
          'animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:slide-in-from-bottom-0 duration-150 ease-out'
      )}
    >
      <div className="w-9 shrink-0">
        {grouped ? (
          <Time
            date={createdAt}
            className="invisible block pt-[5px] text-right text-[11px] group-focus-within/row:visible group-hover/row:visible"
          />
        ) : (
          <UserAvatar
            name={author.name}
            image={author.image}
            className="size-9 rounded-md"
          />
        )}
      </div>
      <div className="min-w-0 flex-1 pb-0.5">
        {!grouped && (
          <p className="flex items-baseline gap-2">
            <span className="text-foreground text-sm font-semibold">
              {author.name}
            </span>
            {trailing ?? <Time date={createdAt} className="text-xs" />}
          </p>
        )}
        {children}
      </div>
      {actions}
    </article>
  );
}

function MessagePreview({
  messageId,
  channelId,
  preview,
  canRemove,
}: {
  messageId: string;
  channelId: string;
  preview: LinkPreview;
  canRemove: boolean;
}) {
  const remove = useRemoveLinkPreview(channelId);

  return (
    <LinkPreviewCard
      preview={preview}
      onRemove={canRemove ? () => remove.mutate({ messageId }) : undefined}
    />
  );
}

function EditedMark() {
  return <span className="text-muted-foreground text-xs">(edited)</span>;
}

export function MessageRow({
  message,
  author,
  grouped,
  viewerId,
  canPost,
  canModerate,
  fresh,
  editing,
  onEdit,
  onStopEditing,
}: {
  message: Message;
  author: Author;
  grouped: boolean;
  viewerId: string | null;
  canPost: boolean;
  canModerate: boolean;
  fresh: boolean;
  editing: boolean;
  onEdit: () => void;
  onStopEditing: () => void;
}) {
  const isAuthor = message.authorId === viewerId;
  const mentionsViewer =
    viewerId !== null &&
    (message.mentionedUserIds.includes(viewerId) ||
      message.mentionsChannel ||
      message.mentionsHere);

  return (
    <RowFrame
      label={`${author.name}, ${timeFormat.format(message.createdAt)}`}
      author={author}
      createdAt={message.createdAt}
      grouped={grouped}
      highlight={mentionsViewer && !message.deletedAt}
      fresh={fresh && !isAuthor}
      actions={
        message.deletedAt || editing ? null : (
          <MessageActions
            message={message}
            canPost={canPost}
            canEdit={isAuthor}
            canDelete={isAuthor || canModerate}
            onEdit={onEdit}
          />
        )
      }
    >
      {message.deletedAt ? (
        <p className="text-muted-foreground text-sm leading-[22px] italic">
          This message was deleted.
        </p>
      ) : editing ? (
        <EditMessage message={message} onDone={onStopEditing} />
      ) : (
        <>
          {message.pinnedAt && (
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              <IconPin className="size-3.5" aria-hidden />
              Pinned
            </p>
          )}
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <MessageMarkdown
              id={message.id}
              updatedAt={message.updatedAt}
              body={message.body}
            />
            {message.editedAt && <EditedMark />}
          </div>
          {message.linkPreview && (
            <MessagePreview
              messageId={message.id}
              channelId={message.channelId}
              preview={message.linkPreview}
              canRemove={isAuthor && canPost}
            />
          )}
          <ReactionBar
            message={message}
            viewerId={viewerId}
            canReact={canPost}
          />
        </>
      )}
    </RowFrame>
  );
}

function EditMessage({
  message,
  onDone,
}: {
  message: Message;
  onDone: () => void;
}) {
  const edit = useEditMessage(message.channelId);

  return (
    <div className="max-w-[72ch] py-1">
      <Composer
        placeholder="Edit message"
        initialMarkdown={message.body}
        mode="save"
        autoFocus
        onCancel={onDone}
        onSubmit={(body) =>
          edit.mutate({ messageId: message.id, body }, { onSuccess: onDone })
        }
      >
        {edit.isError ? (
          <p role="alert" className="text-destructive mt-1 text-xs">
            Couldn&apos;t save. {edit.error.message}
          </p>
        ) : (
          <p className="text-muted-foreground mt-1 text-xs">
            Escape to cancel, Enter to save
          </p>
        )}
      </Composer>
    </div>
  );
}

/** A message the member sent that the server has not stored yet. */
export function PendingRow({
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
    <RowFrame
      label={`${author.name}, ${failed ? 'not sent' : 'sending'}`}
      author={author}
      createdAt={pending.createdAt}
      grouped={grouped}
      trailing={
        failed ? (
          <span className="text-destructive text-xs">Not sent.</span>
        ) : slow ? (
          <span className="text-muted-foreground text-xs">Sending…</span>
        ) : undefined
      }
    >
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
    </RowFrame>
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
