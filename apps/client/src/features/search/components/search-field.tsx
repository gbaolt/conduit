'use client';

import {
  parseSearchQuery,
  type SearchFilter,
  withoutFilter,
} from '@conduit/contract';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@conduit/ui/components/input-group';
import {
  MentionFooter,
  MentionFooterDescription,
  MentionFooterTitle,
  MentionItem,
  MentionItemIcon,
  MentionItemLabel,
  MentionList,
  MentionPopup,
} from '@conduit/ui/components/mention';
import { Tag } from '@conduit/ui/components/tag';
import { IconHash, IconLock, IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useQueryStates } from 'nuqs';
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { UserAvatar } from '@/components/user-avatar';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { channelsQuery } from '@/services/channels/queries';
import { useWorkspaceMembers } from '@/services/workspaces/hooks';

import { searchParams } from '../lib/search-params';

const SUGGESTIONS_MAX = 6;
// The filter being typed at the caret, as in `from:@li` or `in:#des`.
const TYPING = /(?:^|\s)(in:#|in:@|from:@)"?([^\s"]*)$/i;

type Suggestion = {
  id: string;
  label: string;
  detail: string;
  icon: React.ReactNode;
};

function filterLabel(filter: SearchFilter) {
  switch (filter.key) {
    case 'in':
      return `in ${filter.target === 'channel' ? '#' : '@'}${filter.name}`;
    case 'from':
      return `from @${filter.name}`;
    case 'has':
      return 'has a file';
    default:
      return `${filter.key} ${filter.date}`;
  }
}

/** Channels or people for the filter typed at the caret, with the name to insert. */
function useSuggestions(typing: RegExpMatchArray | null): Suggestion[] {
  const { data: channels = [] } = useQuery(channelsQuery);
  const { data: members = [] } = useWorkspaceMembers();
  const prefix = typing?.[1]?.toLowerCase();
  const needle = typing?.[2]?.toLowerCase() ?? '';

  return useMemo(() => {
    if (!prefix) return [];
    if (prefix === 'in:#') {
      return channels
        .filter(
          (channel) =>
            !channel.archivedAt && channel.name.toLowerCase().includes(needle)
        )
        .slice(0, SUGGESTIONS_MAX)
        .map((channel) => ({
          id: channel.id,
          label: channel.name,
          detail:
            channel.topic ||
            `${channel.memberCount} ${channel.memberCount === 1 ? 'member' : 'members'}`,
          icon: (
            <MentionItemIcon>
              {channel.visibility === 'private' ? <IconLock /> : <IconHash />}
            </MentionItemIcon>
          ),
        }));
    }
    return members
      .filter(
        (member) =>
          member.status === 'active' &&
          (member.name.toLowerCase().includes(needle) ||
            member.email.toLowerCase().includes(needle))
      )
      .slice(0, SUGGESTIONS_MAX)
      .map((member) => ({
        id: member.userId,
        label: member.name,
        detail: member.email,
        icon: (
          <UserAvatar
            name={member.name}
            image={member.image}
            className="size-6"
          />
        ),
      }));
  }, [prefix, needle, channels, members]);
}

/** The query field. Each filter typed shows as a chip under it, and `in:` or `from:` suggests names. */
export function SearchField() {
  const [{ q }, setParams] = useQueryStates(searchParams);
  const [draft, setDraft] = useState(q);
  const [caret, setCaret] = useState(q.length);
  const [highlighted, setHighlighted] = useState(0);
  // The caret and text where suggestions were closed. A query that arrives whole starts closed.
  const [dismissed, setDismissed] = useState<string | null>(`${q.length}:${q}`);
  const debounced = useDebouncedValue(draft, 300);
  // The last `q` this field wrote, so a `q` set from elsewhere, such as an empty state's button, replaces the draft.
  const written = useRef(q);

  const write = (text: string) => {
    written.current = text.trim();
    void setParams({ q: written.current || null });
  };

  useEffect(() => {
    if (debounced.trim() !== written.current) write(debounced);
    // Only a settled draft writes the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    if (q === written.current) return;
    written.current = q;
    setDraft(q);
    setCaret(q.length);
    setDismissed(`${q.length}:${q}`);
  }, [q]);

  const commit = (text: string) => {
    setDraft(text);
    setCaret(text.length);
    write(text);
  };

  const before = draft.slice(0, caret);
  const typing = before.match(TYPING);
  const suggestions = useSuggestions(typing);
  const open =
    !!typing && suggestions.length > 0 && dismissed !== `${caret}:${before}`;
  const active = suggestions[Math.min(highlighted, suggestions.length - 1)];
  const { filters } = parseSearchQuery(draft);

  const pick = (suggestion: Suggestion) => {
    if (!typing || typing.index === undefined) return;
    const start =
      typing.index + typing[0].length - typing[0].trimStart().length;
    const name = /\s/.test(suggestion.label)
      ? `"${suggestion.label}"`
      : suggestion.label;
    const token = `${typing[1]}${name} `;
    const next = `${draft.slice(0, start)}${token}${draft.slice(caret).trimStart()}`;
    setDraft(next);
    setCaret(start + token.length);
    setHighlighted(0);
    write(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setHighlighted(
        (current) => (current + step + suggestions.length) % suggestions.length
      );
    } else if ((event.key === 'Enter' || event.key === 'Tab') && active) {
      event.preventDefault();
      pick(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setDismissed(`${caret}:${before}`);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <InputGroup className="h-10">
          <InputGroupAddon>
            <IconSearch />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label="Search"
            placeholder="Search messages, files, channels, and people"
            autoFocus
            role="combobox"
            aria-expanded={open}
            aria-controls="search-suggestions"
            aria-autocomplete="list"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setCaret(
                event.target.selectionStart ?? event.target.value.length
              );
              setHighlighted(0);
            }}
            onSelect={(event) =>
              setCaret(event.currentTarget.selectionStart ?? draft.length)
            }
            onKeyDown={onKeyDown}
            onBlur={() => setDismissed(`${caret}:${before}`)}
          />
        </InputGroup>
        {open && (
          <MentionPopup className="mt-1">
            <MentionList id="search-suggestions" aria-label="Suggestions">
              {suggestions.map((suggestion, index) => (
                <MentionItem
                  key={suggestion.id}
                  highlighted={suggestion === active}
                  className="h-9"
                  onPointerDown={(event) => {
                    // Keep focus in the field, so the caret stays where the name goes.
                    event.preventDefault();
                    pick(suggestion);
                  }}
                  onPointerEnter={() => setHighlighted(index)}
                >
                  {suggestion.icon}
                  <MentionItemLabel>{suggestion.label}</MentionItemLabel>
                </MentionItem>
              ))}
            </MentionList>
            {active && (
              <MentionFooter className="h-12">
                <MentionFooterTitle>{active.label}</MentionFooterTitle>
                <MentionFooterDescription>
                  {active.detail}
                </MentionFooterDescription>
              </MentionFooter>
            )}
          </MentionPopup>
        )}
      </div>
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Filters">
          {filters.map((filter) => (
            <Tag
              key={filter.raw}
              showCloseButton
              closeLabel={`Remove ${filterLabel(filter)}`}
              onClose={() => commit(withoutFilter(draft, filter))}
            >
              {filterLabel(filter)}
            </Tag>
          ))}
        </div>
      )}
    </div>
  );
}
