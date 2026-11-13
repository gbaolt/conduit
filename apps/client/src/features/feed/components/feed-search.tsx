'use client';

import { FEED_SEARCH_MAX } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@conduit/ui/components/input-group';
import { IconSearch, IconX } from '@tabler/icons-react';
import { useQueryStates } from 'nuqs';
import { useState } from 'react';

import { feedParams } from '../lib/feed-params';

/**
 * Searches Activity by message, person, or channel, beside the filter. It rests as a button and opens into a
 * field; an empty field closes again when focus leaves. The text lives in `?q=`, so a search survives a reload.
 */
export function FeedSearch() {
  const [{ q }, setParams] = useQueryStates(feedParams);
  const [opened, setOpened] = useState(false);

  if (!opened && !q) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Search activity"
        onClick={() => setOpened(true)}
      >
        <IconSearch />
      </Button>
    );
  }

  const clear = () => {
    void setParams({ q: null });
    setOpened(false);
  };

  return (
    <InputGroup className="h-8 w-40 sm:w-56">
      <InputGroupAddon>
        <IconSearch />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        aria-label="Search activity"
        placeholder="Search activity"
        autoFocus={opened}
        maxLength={FEED_SEARCH_MAX}
        value={q}
        onChange={(event) => void setParams({ q: event.target.value })}
        onBlur={() => {
          if (!q) setOpened(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            clear();
          }
        }}
        className="[&::-webkit-search-cancel-button]:hidden"
      />
      {q && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label="Clear search"
            onClick={clear}
          >
            <IconX />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
