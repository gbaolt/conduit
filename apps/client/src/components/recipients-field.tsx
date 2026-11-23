'use client';

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
import { IconHash, IconLock, IconUsers } from '@tabler/icons-react';
import { type RefObject, useState } from 'react';

import { PresenceDot } from '@/components/presence-dot';
import { UserAvatar } from '@/components/user-avatar';
import {
  chipsOf,
  choose,
  detailOf,
  labelOf,
  matchesQuery,
  type Recipient,
  type To,
} from '@/lib/recipients';

const CHANNEL_GLYPHS = { public: IconHash, private: IconLock } as const;

/** A row's picture, as the mention menu draws one: an avatar for a person, a glyph otherwise. */
function RecipientsFieldGlyph({ row }: { row: Recipient }) {
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

/** A chip's or the footer's name: `#name` for a channel. */
export const recipientsFieldTitle = (row: Recipient) =>
  row.kind === 'channel' ? `#${row.room.name}` : labelOf(row);

/**
 * Picks one channel, or people who share a DM, with the chips in the field. `autoFocus` also opens the list,
 * as New message does on arrival.
 */
export function RecipientsField({
  recipients,
  to,
  onChange,
  label,
  inputRef,
  autoFocus,
  className,
}: {
  recipients: Recipient[];
  to: To;
  onChange: (to: To) => void;
  label: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
  className?: string;
}) {
  const anchor = useComboboxAnchor();
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState<Recipient>();

  return (
    <Combobox
      multiple
      autoHighlight
      defaultOpen={autoFocus}
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
      <ComboboxChips ref={anchor} className={className}>
        <ComboboxValue>
          {(chips: Recipient[]) => (
            <>
              {chips.map((chip) => (
                <ComboboxChip key={chip.key}>
                  {recipientsFieldTitle(chip)}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                ref={inputRef}
                autoFocus={autoFocus}
                aria-label={label}
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
              <RecipientsFieldGlyph row={row} />
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
            <MentionFooterTitle>
              {recipientsFieldTitle(highlighted)}
            </MentionFooterTitle>
            <MentionFooterDescription>
              {detailOf(highlighted)}
            </MentionFooterDescription>
          </MentionFooter>
        )}
      </ComboboxContent>
    </Combobox>
  );
}
