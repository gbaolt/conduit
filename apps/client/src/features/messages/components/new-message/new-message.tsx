'use client';

import { Button } from '@conduit/ui/components/button';
import { IconX } from '@tabler/icons-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { type ReactNode, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Composer } from '@/components/composer/composer';
import { RecipientsField } from '@/components/recipients-field';
import { useCompose } from '@/hooks/use-compose';
import { useRecipients } from '@/hooks/use-recipients';
import { NOBODY, type To } from '@/lib/recipients';
import { useOpenDm } from '@/services/dms/hooks';
import { useSendToRoom } from '@/services/messages/hooks';

function placeholderFor(to: To) {
  if (to.kind === 'channel') return `Message #${to.room.name}`;
  if (!to.people.length) return 'Start a new message';
  return `Message ${to.people.map((row) => row.person.name).join(', ')}`;
}

/** The main pane: New message while `?compose` is set, the route's page otherwise. */
export function NewMessagePane({ children }: { children: ReactNode }) {
  const [compose] = useCompose();
  return compose ? <NewMessage /> : children;
}

/**
 * Writes a first message to one channel, or to people, who then share a DM. The DM opens only when the
 * message sends, and the page moves to where it went, which also closes the pane.
 */
export function NewMessage() {
  const router = useRouter();
  const [, setCompose] = useCompose();
  const sendToRoom = useSendToRoom();
  const openDm = useOpenDm();
  const { recipients } = useRecipients();
  const [to, setTo] = useState<To>(NOBODY);
  // A message that could not go out comes back into a fresh composer.
  const [unsent, setUnsent] = useState({ key: 0, body: '' });
  const toInput = useRef<HTMLInputElement>(null);

  const keep = (body: string) =>
    setUnsent(({ key }) => ({ key: key + 1, body }));

  const submit = (body: string) => {
    if (to.kind === 'channel') {
      sendToRoom(to.room.id, body);
      router.push(`/channels/${to.room.id}` as Route);
      return;
    }
    if (!to.people.length || openDm.isPending) {
      keep(body);
      toInput.current?.focus();
      return;
    }
    openDm.mutate(
      { userIds: to.people.map((row) => row.person.userId) },
      {
        onSuccess: (dm) => {
          sendToRoom(dm.id, body);
          router.push(`/dms/${dm.id}` as Route);
        },
        onError: (error) => {
          toast.error(error.message);
          keep(body);
        },
      }
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-12 shrink-0 items-center gap-1.5 border-b px-4 py-1.5">
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
          New message
        </h1>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close"
          onClick={() => void setCompose(null)}
        >
          <IconX />
        </Button>
      </header>
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-1.5 text-sm">
        <span className="text-muted-foreground">To:</span>
        <RecipientsField
          recipients={recipients}
          to={to}
          onChange={setTo}
          label="To"
          inputRef={toInput}
          autoFocus
          className="min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 focus-within:ring-0 has-data-[slot=combobox-chip]:px-0 dark:bg-transparent"
        />
      </div>
      <div className="mt-auto px-4 pb-4">
        <Composer
          key={unsent.key}
          initialMarkdown={unsent.body}
          placeholder={placeholderFor(to)}
          onSubmit={submit}
        />
      </div>
    </div>
  );
}
