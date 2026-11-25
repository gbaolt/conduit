'use client';

import {
  type CanvasComment,
  type CanvasCommentThread,
  MESSAGE_BODY_MAX,
} from '@conduit/contract';
import { Badge } from '@conduit/ui/components/badge';
import { Button } from '@conduit/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@conduit/ui/components/empty';
import { Sheet, SheetContent } from '@conduit/ui/components/sheet';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@conduit/ui/components/tabs';
import { Textarea } from '@conduit/ui/components/textarea';
import {
  IconArrowBackUp,
  IconCheck,
  IconDots,
  IconMessage2,
  IconPencil,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { SidePanel } from '@/components/side-panel';
import { UserAvatar } from '@/components/user-avatar';
import { useMediaQuery } from '@/hooks/use-media-query';
import { sessionQuery } from '@/services/auth/queries';
import {
  useDeleteCanvasComment,
  useEditCanvasComment,
  useReplyCanvasComment,
  useResolveCanvasCommentThread,
} from '@/services/canvases/hooks';
import { canvasCommentsQuery } from '@/services/canvases/queries';

import { useCanvasComments } from './canvas-comments-plugin';

type Filter = 'open' | 'resolved';

const sentFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** A comment box with a submit button, for a reply or an edit. */
function CanvasCommentsPanelForm({
  initial = '',
  label,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: string;
  label: string;
  submitLabel: string;
  pending: boolean;
  onSubmit: (body: string, reset: () => void) => void;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState(initial);
  const submit = () => {
    if (body.trim() && !pending) onSubmit(body, () => setBody(''));
  };

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        aria-label={label}
        placeholder={label}
        value={body}
        maxLength={MESSAGE_BODY_MAX}
        autoFocus={Boolean(onCancel)}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            submit();
          }
          if (event.key === 'Escape' && onCancel) {
            event.stopPropagation();
            onCancel();
          }
        }}
        className="min-h-9 resize-none text-sm"
      />
      {(body.trim() || onCancel) && (
        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button variant="ghost" size="xs" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <StatusButton
            size="xs"
            disabled={!body.trim()}
            status={pending ? 'loading' : 'idle'}
            onClick={submit}
          >
            {submitLabel}
          </StatusButton>
        </div>
      )}
    </div>
  );
}

function CanvasCommentsPanelComment({
  thread,
  comment,
}: {
  thread: CanvasCommentThread;
  comment: CanvasComment;
}) {
  const { canvasId, canComment, notify, unmarkThread } = useCanvasComments();
  const { data: session } = useQuery(sessionQuery);
  const edit = useEditCanvasComment();
  const remove = useDeleteCanvasComment();
  const [editing, setEditing] = useState(false);
  const own = canComment && comment.author.id === session?.user.id;

  const deleteComment = () =>
    remove.mutate(
      { canvasId, commentId: comment.id },
      {
        onSuccess: () => {
          // The thread leaves the list with its last comment, so its passage stops being highlighted.
          if (thread.comments.length === 1) unmarkThread(thread.id);
          notify();
        },
        onError: (error) => toast.error(error.message),
      }
    );

  return (
    <li className="flex gap-2.5">
      <UserAvatar
        name={comment.author.name}
        image={comment.author.image}
        className="size-6"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium">
            {comment.author.name}
          </span>
          <time
            dateTime={comment.createdAt.toISOString()}
            className="text-muted-foreground shrink-0 text-xs"
          >
            {sentFormat.format(comment.createdAt)}
            {comment.editedAt && ' (edited)'}
          </time>
          {own && !editing && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Comment actions"
                    className="ml-auto"
                  />
                }
              >
                <IconDots />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <IconPencil data-slot="icon" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={deleteComment}
                >
                  <IconTrash data-slot="icon" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {editing ? (
          <div className="mt-1">
            <CanvasCommentsPanelForm
              initial={comment.body}
              label="Edit comment"
              submitLabel="Save"
              pending={edit.isPending}
              onCancel={() => setEditing(false)}
              onSubmit={(body) =>
                edit.mutate(
                  { canvasId, commentId: comment.id, body },
                  {
                    onSuccess: () => {
                      setEditing(false);
                      notify();
                    },
                    onError: (error) => toast.error(error.message),
                  }
                )
              }
            />
          </div>
        ) : (
          <p className="text-sm break-words whitespace-pre-wrap">
            {comment.body}
          </p>
        )}
      </div>
    </li>
  );
}

function CanvasCommentsPanelThread({
  thread,
}: {
  thread: CanvasCommentThread;
}) {
  const {
    canvasId,
    canComment,
    activeThreadId,
    openThread,
    markedThreadIds,
    unmarkThread,
    notify,
  } = useCanvasComments();
  const reply = useReplyCanvasComment();
  const resolve = useResolveCanvasCommentThread();
  const resolved = thread.resolvedAt !== null;
  const orphaned = !resolved && !markedThreadIds.has(thread.id);

  const setResolved = (next: boolean) =>
    resolve.mutate(
      { canvasId, threadId: thread.id, resolved: next },
      {
        onSuccess: () => {
          if (next) unmarkThread(thread.id);
          notify();
        },
        onError: (error) => toast.error(error.message),
      }
    );

  return (
    <article
      aria-label={`Comments on “${thread.quote}”`}
      data-active={thread.id === activeThreadId || undefined}
      className="data-active:bg-muted/60 border-b px-4 py-3"
    >
      <div className="flex items-start gap-2">
        <Button
          variant="ghost"
          onClick={() => openThread(thread.id)}
          className="text-muted-foreground h-auto min-w-0 flex-1 justify-start rounded-none border-l-2 border-amber-400/70 px-2 py-0 text-left font-normal whitespace-normal"
        >
          <span className="line-clamp-3">{thread.quote}</span>
        </Button>
        {canComment && (
          <Button
            variant="ghost"
            size="xs"
            disabled={resolve.isPending}
            onClick={() => setResolved(!resolved)}
          >
            {resolved ? (
              <IconArrowBackUp data-icon="inline-start" />
            ) : (
              <IconCheck data-icon="inline-start" />
            )}
            {resolved ? 'Reopen' : 'Resolve'}
          </Button>
        )}
      </div>
      {orphaned && (
        <p className="text-muted-foreground mt-1 text-xs">
          The commented text was removed from the canvas.
        </p>
      )}
      <ul className="mt-3 flex flex-col gap-3">
        {thread.comments.map((comment) => (
          <CanvasCommentsPanelComment
            key={comment.id}
            thread={thread}
            comment={comment}
          />
        ))}
      </ul>
      {canComment && !resolved && (
        <div className="mt-3 pl-8">
          <CanvasCommentsPanelForm
            label="Reply"
            submitLabel="Reply"
            pending={reply.isPending}
            onSubmit={(body, reset) =>
              reply.mutate(
                { canvasId, threadId: thread.id, body },
                {
                  onSuccess: () => {
                    reset();
                    notify();
                  },
                  onError: (error) => toast.error(error.message),
                }
              )
            }
          />
        </div>
      )}
    </article>
  );
}

function CanvasCommentsPanelSkeleton() {
  return (
    <div role="status" aria-label="Loading comments" className="space-y-5 p-4">
      {['w-3/5', 'w-4/5'].map((width) => (
        <div key={width} className="space-y-2">
          <Skeleton className={`h-4 ${width}`} />
          <div className="flex gap-2.5">
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CanvasCommentsPanelList({ filter }: { filter: Filter }) {
  const { canvasId, canComment } = useCanvasComments();
  const comments = useQuery(canvasCommentsQuery(canvasId));

  if (comments.isPending) return <CanvasCommentsPanelSkeleton />;
  if (comments.isError) {
    return (
      <p className="text-muted-foreground p-4 text-sm">
        Couldn&apos;t load comments.{' '}
        <Button
          variant="link"
          size="xs"
          onClick={() => void comments.refetch()}
        >
          Retry
        </Button>
      </p>
    );
  }
  const threads = comments.data.filter(
    (thread) => (thread.resolvedAt !== null) === (filter === 'resolved')
  );
  if (threads.length === 0) {
    let hint = 'Comments people add to this canvas show up here.';
    if (canComment)
      hint = 'Select text and choose Comment, or press Ctrl+Alt+M.';
    if (filter === 'resolved') {
      hint = 'Threads you resolve move here, with the text they were about.';
    }
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconMessage2 />
          </EmptyMedia>
          <EmptyTitle>
            {filter === 'open' ? 'No open comments' : 'No resolved comments'}
          </EmptyTitle>
          <EmptyDescription>{hint}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return threads.map((thread) => (
    <CanvasCommentsPanelThread key={thread.id} thread={thread} />
  ));
}

function CanvasCommentsPanelContent() {
  const { canvasId, setPanelOpen } = useCanvasComments();
  const { data: threads } = useQuery(canvasCommentsQuery(canvasId));
  const [filter, setFilter] = useState<Filter>('open');
  const count = (resolved: boolean) =>
    threads?.filter((thread) => (thread.resolvedAt !== null) === resolved)
      .length ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-12 shrink-0 items-center gap-2 border-b px-4">
        <h2 className="text-base font-semibold">Comments</h2>
        <Tabs
          value={filter}
          onValueChange={(next) => setFilter(next as Filter)}
          className="ml-auto"
        >
          <TabsList aria-label="Filter comments">
            <TabsTrigger value="open">
              Open
              <Badge variant="secondary">{count(false)}</Badge>
            </TabsTrigger>
            <TabsTrigger value="resolved">
              Resolved
              <Badge variant="secondary">{count(true)}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close comments"
          onClick={() => setPanelOpen(false)}
        >
          <IconX />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <CanvasCommentsPanelList filter={filter} />
      </div>
    </div>
  );
}

/**
 * The canvas's comment threads, in the side card from xl up and in a right sheet below it. The side card opens
 * in the same paint as the click; the sheet keeps its slide, since it covers the canvas.
 */
export function CanvasCommentsPanel() {
  const { panelOpen, setPanelOpen } = useCanvasComments();
  const docked = useMediaQuery('(min-width: 80rem)');

  if (docked) {
    return (
      panelOpen && (
        <SidePanel>
          <CanvasCommentsPanelContent />
        </SidePanel>
      )
    );
  }
  return (
    <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-label="Comments"
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <CanvasCommentsPanelContent />
      </SheetContent>
    </Sheet>
  );
}
