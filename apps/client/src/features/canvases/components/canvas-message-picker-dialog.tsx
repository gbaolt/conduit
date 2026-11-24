'use client';

import { plainText } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@conduit/ui/components/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@conduit/ui/components/empty';
import { Input } from '@conduit/ui/components/input';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { IconHash, IconMessage } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useAuthors } from '@/features/messages/hooks/use-authors';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { searchQuery } from '@/services/search/queries';

import { parseMessageUrl } from '../lib/message-url';

function CanvasMessagePickerDialogResults({
  text,
  onPick,
}: {
  text: string;
  onPick: (messageId: string) => void;
}) {
  const search = useQuery(searchQuery(text));
  const { names } = useAuthors();

  if (!text.trim()) {
    return (
      <p className="text-muted-foreground px-1 py-6 text-center text-sm">
        Search for a message, or paste a link from its Copy link.
      </p>
    );
  }
  if (search.isPending) {
    return (
      <div role="status" aria-label="Searching" className="space-y-3 py-2">
        {['w-3/4', 'w-1/2', 'w-2/3'].map((width) => (
          <Skeleton key={width} className={`h-10 ${width}`} />
        ))}
      </div>
    );
  }
  if (search.isError) {
    return (
      <p className="text-muted-foreground px-1 py-6 text-center text-sm">
        Couldn&apos;t search messages.{' '}
        <Button variant="link" size="xs" onClick={() => void search.refetch()}>
          Retry
        </Button>
      </p>
    );
  }
  if (search.data.messages.length === 0) {
    return (
      <Empty className="py-6">
        <EmptyHeader>
          <EmptyTitle>No messages found</EmptyTitle>
          <EmptyDescription>Try other words.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <ul className="-mx-2 flex max-h-80 flex-col overflow-y-auto">
      {search.data.messages.map((message) => {
        const Glyph = message.room.kind === 'dm' ? IconMessage : IconHash;
        return (
          <li key={message.id}>
            <Button
              variant="ghost"
              onClick={() => onPick(message.id)}
              className="h-auto w-full flex-col items-start gap-0.5 px-2 py-2 text-left font-normal whitespace-normal"
            >
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <Glyph className="size-3.5" aria-hidden />
                {message.room.kind === 'dm'
                  ? 'Direct message'
                  : message.room.name}
                <span aria-hidden>·</span>
                {message.author.name}
              </span>
              <span className="line-clamp-2 text-sm">
                {plainText(message.body, Object.fromEntries(names))}
              </span>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/** Opened by `/message`: finds a message the viewer can read, or takes a pasted link to one. */
export function CanvasMessagePickerDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (messageId: string) => void;
}) {
  const [text, setText] = useState('');
  const query = useDebouncedValue(text, 250);
  const linked = parseMessageUrl(text, window.location.origin);

  const pick = (messageId: string) => {
    onPick(messageId);
    onOpenChange(false);
    setText('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Embed a message</DialogTitle>
          <DialogDescription>
            Everyone sees it only if they can read its conversation.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          aria-label="Search messages or paste a link"
          placeholder="Search messages or paste a link"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && linked) pick(linked);
          }}
        />
        {linked ? (
          <Button onClick={() => pick(linked)}>Embed this message</Button>
        ) : (
          <CanvasMessagePickerDialogResults text={query} onPick={pick} />
        )}
      </DialogContent>
    </Dialog>
  );
}
