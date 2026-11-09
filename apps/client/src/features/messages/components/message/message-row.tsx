'use client';

import type { LinkPreview, Message as MessageData } from '@conduit/contract';
import { IconCornerDownRight, IconPin } from '@tabler/icons-react';
import { use } from 'react';

import {
  useEditMessage,
  useRemoveLinkPreview,
} from '@/services/messages/hooks';

import { OpenThread } from '../../context/thread';
import { Composer } from '../composer/composer';
import {
  type Author,
  Message,
  MessageAuthor,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageTime,
  timeFormat,
} from './message';
import { MessageActions } from './message-actions';
import { MessageLinkPreview } from './message-link-preview';
import { MessageMarkdown } from './message-markdown';
import { MessageReactions } from './message-reactions';

function MessagePreview({
  messageId,
  preview,
  canRemove,
}: {
  messageId: string;
  preview: LinkPreview;
  canRemove: boolean;
}) {
  const remove = useRemoveLinkPreview();

  return (
    <MessageLinkPreview
      preview={preview}
      onRemove={canRemove ? () => remove.mutate({ messageId }) : undefined}
    />
  );
}

/** Under a root that has replies: opens its thread. */
function ThreadLine({
  rootId,
  count,
  lastReplyAt,
}: {
  rootId: string;
  count: number;
  lastReplyAt: Date | null;
}) {
  const openThread = use(OpenThread);
  const label = count === 1 ? '1 reply' : `${count} replies`;

  return (
    <button
      type="button"
      data-thread-line={rootId}
      disabled={!openThread}
      aria-label={`${label}. Open thread`}
      className="hover:bg-background focus-visible:ring-ring/50 -ml-1 flex w-fit items-baseline gap-2 rounded-md px-1 py-0.5 text-left outline-none focus-visible:ring-3 pointer-coarse:min-h-11"
      onClick={() => openThread?.(rootId)}
    >
      <span className="text-primary text-[13px] font-medium">{label}</span>
      {lastReplyAt && (
        <span className="text-muted-foreground text-xs">
          Last reply <MessageTime date={lastReplyAt} className="text-xs" />
        </span>
      )}
    </button>
  );
}

/** Above a reply that was also sent to the channel: opens the thread it belongs to. */
function RepliedLine({ rootId }: { rootId: string }) {
  const openThread = use(OpenThread);

  return (
    <button
      type="button"
      disabled={!openThread}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex items-center gap-1 rounded text-xs outline-none focus-visible:ring-3"
      onClick={() => openThread?.(rootId)}
    >
      <IconCornerDownRight className="size-3.5" aria-hidden />
      Replied to a thread
    </button>
  );
}

export function MessageRow({
  message,
  author,
  grouped,
  viewerId,
  canPost,
  canModerate,
  fresh,
  focused,
  editing,
  onEdit,
  onStopEditing,
  inThread,
}: {
  message: MessageData;
  author: Author;
  grouped: boolean;
  viewerId: string | null;
  canPost: boolean;
  canModerate: boolean;
  fresh: boolean;
  focused: boolean;
  editing: boolean;
  onEdit: () => void;
  onStopEditing: () => void;
  /** Rendered inside the thread panel, which already shows the thread. */
  inThread: boolean;
}) {
  const isAuthor = message.authorId === viewerId;
  const mentionsViewer =
    viewerId !== null &&
    (message.mentionedUserIds.includes(viewerId) ||
      message.mentionsChannel ||
      message.mentionsHere);

  return (
    <Message
      label={`${author.name}, ${timeFormat.format(message.createdAt)}`}
      createdAt={message.createdAt}
      grouped={grouped}
      highlight={mentionsViewer && !message.deletedAt}
      focused={focused}
      fresh={fresh && !isAuthor}
    >
      <MessageAvatar author={author} />
      <MessageContent className="pb-0.5">
        <MessageHeader>
          <MessageAuthor>{author.name}</MessageAuthor>
          <MessageTime date={message.createdAt} className="text-xs" />
        </MessageHeader>
        {message.deletedAt && (
          <p className="text-muted-foreground text-sm leading-[22px] italic">
            This message was deleted.
          </p>
        )}
        {!message.deletedAt && editing && (
          <EditMessage message={message} onDone={onStopEditing} />
        )}
        {!message.deletedAt && !editing && (
          <>
            {message.pinnedAt && (
              <p className="text-muted-foreground flex items-center gap-1 text-xs">
                <IconPin className="size-3.5" aria-hidden />
                Pinned
              </p>
            )}
            {message.parentId && !inThread && (
              <RepliedLine rootId={message.parentId} />
            )}
            <MessageMarkdown
              id={message.id}
              updatedAt={message.updatedAt}
              body={message.body}
            />
            {message.linkPreview && (
              <MessagePreview
                messageId={message.id}
                preview={message.linkPreview}
                canRemove={isAuthor && canPost}
              />
            )}
            <MessageReactions
              message={message}
              viewerId={viewerId}
              canReact={canPost}
            />
            {!inThread && message.replyCount > 0 && (
              <ThreadLine
                rootId={message.id}
                count={message.replyCount}
                lastReplyAt={message.lastReplyAt}
              />
            )}
          </>
        )}
      </MessageContent>
      {!message.deletedAt && !editing && (
        <MessageActions
          message={message}
          canPost={canPost}
          canEdit={isAuthor}
          canDelete={isAuthor || canModerate}
          canReplyInThread={!inThread && !message.parentId}
          onEdit={onEdit}
        />
      )}
    </Message>
  );
}

function EditMessage({
  message,
  onDone,
}: {
  message: MessageData;
  onDone: () => void;
}) {
  const edit = useEditMessage();

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
