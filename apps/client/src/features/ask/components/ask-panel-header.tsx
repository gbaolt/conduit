'use client';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@conduit/ui/components/alert-dialog';
import { Button } from '@conduit/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import {
  IconDots,
  IconHistory,
  IconPlus,
  IconSparkles,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { useDeleteAskChat } from '@/services/ask/hooks';
import { askChatsQuery } from '@/services/ask/queries';

import { useAsk } from '../context/ask-provider';

const dayFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

/** Today's chats show their time, so several on one day can be told apart. */
const whenFormat = (date: Date) =>
  (date.toDateString() === new Date().toDateString()
    ? timeFormat
    : dayFormat
  ).format(date);

function AskHistoryMenu() {
  const { chatId, startChat } = useAsk();
  const chats = useQuery(askChatsQuery);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Recent chats"
            className="pointer-coarse:size-11"
          />
        }
      >
        <IconHistory />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Recent chats</DropdownMenuLabel>
          {chats.data?.length ? (
            chats.data.map((chat) => (
              <DropdownMenuItem
                key={chat.id}
                aria-current={chat.id === chatId || undefined}
                className="aria-current:bg-muted"
                onClick={() => startChat(chat.id)}
              >
                <span className="min-w-0 flex-1 truncate">{chat.title}</span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {whenFormat(chat.updatedAt)}
                </span>
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>
              {chats.isPending ? 'Loading…' : 'No chats yet'}
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeleteChatDialog({
  chatId,
  open,
  onOpenChange,
}: {
  chatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { startChat } = useAsk();
  const { mutate, isPending } = useDeleteAskChat();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
          <AlertDialogDescription>
            Its questions and answers are gone for good. The messages and files
            it cited stay where they are.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <StatusButton
            variant="destructive"
            status={isPending ? 'loading' : 'idle'}
            onClick={() =>
              mutate(
                { chatId },
                {
                  onSuccess: () => {
                    onOpenChange(false);
                    startChat(null);
                  },
                  onError: (error) => toast.error(error.message),
                }
              )
            }
          >
            Delete chat
          </StatusButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** The panel's title and its controls: recent chats, a new chat, deleting this one, and closing. */
export function AskPanelHeader() {
  const { chatId, startChat, close } = useAsk();
  const [deleting, setDeleting] = useState(false);

  return (
    <header className="flex min-h-12 shrink-0 items-center gap-1 border-b px-2">
      <h2 className="ml-2 flex min-w-0 flex-1 items-center gap-2 font-semibold">
        <IconSparkles className="size-4" /> Ask Conduit
      </h2>
      <AskHistoryMenu />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="New chat"
        className="pointer-coarse:size-11"
        onClick={() => startChat(null)}
      >
        <IconPlus />
      </Button>
      {chatId && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Chat actions"
                  className="pointer-coarse:size-11"
                />
              }
            >
              <IconDots />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleting(true)}
              >
                <IconTrash />
                Delete chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DeleteChatDialog
            chatId={chatId}
            open={deleting}
            onOpenChange={setDeleting}
          />
        </>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Close Ask Conduit"
        className="pointer-coarse:size-11"
        onClick={close}
      >
        <IconX />
      </Button>
    </header>
  );
}
