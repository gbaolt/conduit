'use client';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@conduit/ui/components/input-group';
import { cn } from '@conduit/ui/lib/utils';
import { IconSearch, IconX } from '@tabler/icons-react';
import { parseAsString, useQueryState } from 'nuqs';

const searchParser = parseAsString.withDefault('');

/**
 * A search field whose text lives in the URL under `name`, so a search survives a reload and a shared link.
 * Escape and the clear button empty it.
 */
export function FilterSearch({
  name = 'q',
  label,
  placeholder = label,
  className,
}: {
  name?: string;
  /** The accessible name, such as "Search people". */
  label: string;
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useQueryState(name, searchParser);
  const clear = () => void setValue(null);

  return (
    <InputGroup className={cn('h-8', className)}>
      <InputGroupAddon>
        <IconSearch />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => void setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault();
            clear();
          }
        }}
        className="[&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
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
