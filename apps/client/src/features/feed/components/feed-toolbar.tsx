'use client';

import { type FeedGroup, isGroupUnread } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from '@conduit/ui/components/button-group';
import { Checkbox } from '@conduit/ui/components/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import { Field, FieldLabel } from '@conduit/ui/components/field';
import { Switch } from '@conduit/ui/components/switch';
import {
  IconChevronDown,
  IconMail,
  IconMailOpened,
  IconX,
} from '@tabler/icons-react';
import { useQueryStates } from 'nuqs';
import { useId } from 'react';

import {
  useFeedUnreadCount,
  useMarkAllFeedRead,
  useMarkFeedRead,
  useMarkFeedUnread,
} from '@/services/feed/hooks';

import { feedParams } from '../lib/feed-params';
import { FeedSortSelect } from './feed-sort-select';

const SELECTIONS = [
  { label: 'None', pick: () => false },
  { label: 'Select all', pick: () => true },
  { label: 'Select read', pick: (group: FeedGroup) => !isGroupUnread(group) },
  { label: 'Select unread', pick: isGroupUnread },
] satisfies { label: string; pick: (group: FeedGroup) => boolean }[];

/** The first menu entry whose rows are exactly the selection, or Custom for rows picked by hand. */
function selectionLabel(
  groups: readonly FeedGroup[],
  selected: readonly FeedGroup[]
) {
  const ids = new Set(selected.map((group) => group.id));
  const match = SELECTIONS.find(({ pick }) => {
    const picked = groups.filter(pick);
    return (
      picked.length === ids.size && picked.every((group) => ids.has(group.id))
    );
  });
  return match?.label ?? 'Custom';
}

/** The box that selects every row or none, and the menu that names the selection and selects by state. */
function FeedToolbarSelect({
  groups,
  selected,
  onSelect,
}: {
  groups: readonly FeedGroup[];
  selected: readonly FeedGroup[];
  onSelect: (groups: FeedGroup[]) => void;
}) {
  const all = groups.length > 0 && selected.length === groups.length;
  const label = selectionLabel(groups, selected);

  return (
    <ButtonGroup>
      <ButtonGroupText
        render={<label />}
        className="cursor-pointer px-1.5 has-disabled:cursor-default has-disabled:opacity-50"
      >
        <Checkbox
          data-icon="inline-start"
          aria-label={selected.length > 0 ? 'Select none' : 'Select all'}
          disabled={groups.length === 0}
          checked={all}
          indeterminate={selected.length > 0 && !all}
          onCheckedChange={() =>
            onSelect(selected.length > 0 ? [] : [...groups])
          }
        />
        {label}
      </ButtonGroupText>
      <ButtonGroupSeparator />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label={`Selected: ${label}. Select by state`}
              disabled={groups.length === 0}
              className="text-muted-foreground"
            />
          }
        >
          <IconChevronDown />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-36">
          <DropdownMenuRadioGroup
            value={label}
            onValueChange={(value) => {
              const choice = SELECTIONS.find((s) => s.label === value);
              if (choice) onSelect(groups.filter(choice.pick));
            }}
          >
            {SELECTIONS.map((choice) => (
              <DropdownMenuRadioItem key={choice.label} value={choice.label}>
                {choice.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}

/** What to do with the selected rows. */
function FeedToolbarActions({
  selected,
  onSelect,
}: {
  selected: readonly FeedGroup[];
  onSelect: (groups: FeedGroup[]) => void;
}) {
  const markRead = useMarkFeedRead();
  const markUnread = useMarkFeedUnread();
  const entries = selected.flatMap((group) => group.entries);
  const unreadIds = entries.filter((e) => !e.readAt).map((e) => e.id);
  const readIds = entries.filter((e) => e.readAt).map((e) => e.id);

  return (
    <>
      <p className="text-sm font-medium tabular-nums" aria-live="polite">
        {selected.length} selected
      </p>
      <Button
        variant="ghost"
        size="sm"
        disabled={unreadIds.length === 0}
        onClick={() => markRead.mutate(unreadIds)}
      >
        <IconMailOpened data-icon="inline-start" />
        Mark read
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={readIds.length === 0}
        onClick={() => markUnread.mutate(readIds)}
      >
        <IconMail data-icon="inline-start" />
        Mark unread
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Clear selection"
        className="ml-auto"
        onClick={() => onSelect([])}
      >
        <IconX />
      </Button>
    </>
  );
}

/** The unread switch, the sort, and Mark all read, while nothing is selected. */
function FeedToolbarFilters() {
  const [{ unread, sort }, setParams] = useQueryStates(feedParams);
  const unreadCount = useFeedUnreadCount();
  const markAllRead = useMarkAllFeedRead();
  const switchId = useId();

  return (
    <>
      <Field orientation="horizontal" className="ml-1 w-auto">
        <Switch
          id={switchId}
          checked={unread}
          onCheckedChange={(checked) =>
            void setParams({ unread: checked || null })
          }
        />
        <FieldLabel
          htmlFor={switchId}
          className="text-muted-foreground cursor-pointer font-normal"
        >
          Unread only
        </FieldLabel>
      </Field>
      <div className="ml-auto flex items-center gap-1">
        <FeedSortSelect
          sort={sort}
          onSortChange={(next) => void setParams({ sort: next })}
        />
        <Button
          variant="ghost"
          size="sm"
          disabled={unreadCount === 0 || markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
        >
          Mark all read
        </Button>
      </div>
    </>
  );
}

/** The row above the list: selection on the left, then either what to do with it or the list's own filters. */
export function FeedToolbar({
  groups,
  selected,
  onSelect,
}: {
  groups: readonly FeedGroup[];
  selected: readonly FeedGroup[];
  onSelect: (groups: FeedGroup[]) => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Activity"
      className="flex min-h-12 flex-wrap items-center gap-x-1 gap-y-1 py-2"
    >
      <FeedToolbarSelect
        groups={groups}
        selected={selected}
        onSelect={onSelect}
      />
      {selected.length > 0 ? (
        <FeedToolbarActions selected={selected} onSelect={onSelect} />
      ) : (
        <FeedToolbarFilters />
      )}
    </div>
  );
}
