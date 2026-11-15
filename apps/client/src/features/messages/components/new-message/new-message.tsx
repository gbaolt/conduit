'use client';

import { canChannel } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@conduit/ui/components/combobox';
import {
  MentionFooter,
  MentionFooterDescription,
  MentionFooterTitle,
  MentionItemIcon,
  MentionItemLabel,
} from '@conduit/ui/components/mention';
import { IconHash, IconLock, IconUsers, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import {
  type ReactNode,
  type RefObject,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

import { PresenceDot } from '@/components/presence-dot';
import { UserAvatar } from '@/components/user-avatar';
import { useCompose } from '@/hooks/use-compose';
import { sidebarStateQuery } from '@/services/activity/queries';
import { sessionQuery } from '@/services/auth/queries';
import { channelsQuery } from '@/services/channels/queries';
import { useOpenDm } from '@/services/dms/hooks';
import { dmsQuery } from '@/services/dms/queries';
import { useSendToRoom } from '@/services/messages/hooks';
import {
  useWorkspaceMembers,
  useWorkspaceRole,
} from '@/services/workspaces/hooks';

import {
  chipsOf,
  choose,
  detailOf,
  labelOf,
  matchesQuery,
  NOBODY,
  type Recipient,
  recipientsOf,
  type To,
} from '../../lib/recipients';
import { Composer } from '../composer/composer';

/** A row's picture, as the mention menu draws one: an avatar for a person, a glyph otherwise. */
function RecipientGlyph({ row }: { row: Recipient }) {
  if (row.kind === 'person') {
    return (
      <UserAvatar
        name={row.person.name}
        image={row.person.image}
        className="size-6 shrink-0 text-[10px]"
      />
    );
  }
  const Glyph =
    row.kind === 'group' ? IconUsers : CHANNEL_GLYPHS[row.room.visibility];
  return (
    <MentionItemIcon>
      <Glyph />
    </MentionItemIcon>
  );
}

const CHANNEL_GLYPHS = { public: IconHash, private: IconLock } as const;

const titleOf = (row: Recipient) =>
  row.kind === 'channel' ? `#${row.room.name}` : labelOf(row);

function placeholderFor(to: To) {
  if (to.kind === 'channel') return `Message #${to.room.name}`;
  if (!to.people.length) return 'Start a new message';
  return `Message ${to.people.map((row) => row.person.name).join(', ')}`;
}

function NewMessageTo({
  recipients,
  to,
  onChange,
  inputRef,
}: {
  recipients: Recipient[];
  to: To;
  onChange: (to: To) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const anchor = useComboboxAnchor();
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState<Recipient>();

  return (
    <Combobox
      multiple
      autoHighlight
      defaultOpen
      items={recipients}
      value={chipsOf(to)}
      onValueChange={(next: Recipient[]) => {
        onChange(choose(to, next));
        setQuery('');
      }}
      inputValue={query}
      onInputValueChange={setQuery}
      onItemHighlighted={setHighlighted}
      // The list stays open for the next pick. Closing on a pick also freezes the old query in Base UI 1.7
      // when typing reopens the list before it finishes closing.
      onOpenChange={(open, details) => {
        if (!open && details.reason === 'item-press') details.cancel();
      }}
      itemToStringLabel={labelOf}
      isItemEqualToValue={(a: Recipient, b: Recipient) => a.key === b.key}
      filter={matchesQuery}
    >
      <ComboboxChips
        ref={anchor}
        className="min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 focus-within:ring-0 has-data-[slot=combobox-chip]:px-0 dark:bg-transparent"
      >
        <ComboboxValue>
          {(chips: Recipient[]) => (
            <>
              {chips.map((chip) => (
                <ComboboxChip key={chip.key}>{titleOf(chip)}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                ref={inputRef}
                autoFocus
                aria-label="To"
                placeholder={chips.length ? '' : '#a-channel or @somebody'}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No channels or people match.</ComboboxEmpty>
        <ComboboxList>
          {(row: Recipient) => (
            <ComboboxItem
              key={row.key}
              value={row}
              className="gap-2.5 px-2 py-1.5"
            >
              <RecipientGlyph row={row} />
              <MentionItemLabel>
                {labelOf(row)}
                {row.kind === 'person' && row.isViewer && (
                  <span className="text-muted-foreground font-normal">
                    {' '}
                    (you)
                  </span>
                )}
              </MentionItemLabel>
              {row.kind === 'person' && (
                <PresenceDot userId={row.person.userId} className="shrink-0" />
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
        {highlighted && (
          <MentionFooter>
            <MentionFooterTitle>{titleOf(highlighted)}</MentionFooterTitle>
            <MentionFooterDescription>
              {detailOf(highlighted)}
            </MentionFooterDescription>
          </MentionFooter>
        )}
      </ComboboxContent>
    </Combobox>
  );
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
  const workspaceRole = useWorkspaceRole();
  const { data: session } = useQuery(sessionQuery);
  const { data: channels = [] } = useQuery(channelsQuery);
  const { data: dms = [] } = useQuery(dmsQuery);
  const { data: entries = [] } = useQuery(sidebarStateQuery);
  const { data: members = [] } = useWorkspaceMembers();
  const [to, setTo] = useState<To>(NOBODY);
  // A message that could not go out comes back into a fresh composer.
  const [unsent, setUnsent] = useState({ key: 0, body: '' });
  const toInput = useRef<HTMLInputElement>(null);
  const viewerId = session?.user.id ?? '';

  const recipients = useMemo(
    () =>
      recipientsOf({
        channels: channels.filter(
          (room) => room.membership && canChannel('post', workspaceRole, room)
        ),
        dms,
        people: members.filter((member) => member.status === 'active'),
        entries,
        viewerId,
      }),
    [channels, dms, members, entries, viewerId, workspaceRole]
  );

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
        <NewMessageTo
          recipients={recipients}
          to={to}
          onChange={setTo}
          inputRef={toInput}
        />
      </div>
      <div className="mt-auto px-4 pb-4 sm:px-5">
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
