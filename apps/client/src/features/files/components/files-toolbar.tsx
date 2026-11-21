'use client';

import { FILE_SEARCH_MAX, type FileKind } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@conduit/ui/components/input-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@conduit/ui/components/select';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { IconSearch, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useQueryStates } from 'nuqs';
import { useState } from 'react';

import { channelsQuery } from '@/services/channels/queries';
import { membersQuery } from '@/services/workspaces/queries';

import { filesParams } from '../lib/files-params';

const ANY = 'any';

export const KIND_LABELS: Record<FileKind, string> = {
  image: 'Images',
  video: 'Videos',
  pdf: 'PDFs',
  other: 'Other files',
};

/** One filter: its name, then its current value, or "Any" when nothing is picked. */
function FilesFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
}) {
  const items = [{ value: ANY, label: 'Any' }, ...options];

  return (
    <Select
      items={items}
      value={value || ANY}
      onValueChange={(next) => onChange(!next || next === ANY ? null : next)}
    >
      <SelectTrigger size="sm" aria-label={label} className="max-w-56">
        <span className="text-muted-foreground">{label}</span>
        <SelectValue className="truncate" />
      </SelectTrigger>
      <SelectContent align="start">
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Narrows the Files page by name. It rests as a button and opens into a field, as Activity's search does. */
function FilesSearch() {
  const [{ q }, setParams] = useQueryStates(filesParams);
  const [opened, setOpened] = useState(false);

  if (!opened && !q) {
    return (
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Search file names"
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
        aria-label="Search file names"
        placeholder="Search file names"
        autoFocus={opened}
        maxLength={FILE_SEARCH_MAX}
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

/** The channel, person, and type filters, then the name search beside them. All live in the URL. */
export function FilesToolbar() {
  const [{ room, person, type }, setParams] = useQueryStates(filesParams);
  const { data: channels } = useQuery(channelsQuery);
  const { data: members } = useQuery(membersQuery);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-4">
      <FilesFilter
        label="Channel"
        value={room}
        options={(channels ?? []).map((channel) => ({
          value: channel.id,
          label: `#${channel.name}`,
        }))}
        onChange={(next) => void setParams({ room: next })}
      />
      <FilesFilter
        label="Person"
        value={person}
        options={(members ?? []).map((member) => ({
          value: member.userId,
          label: member.name,
        }))}
        onChange={(next) => void setParams({ person: next })}
      />
      <FilesFilter
        label="Type"
        value={type ?? ''}
        options={Object.entries(KIND_LABELS).map(([value, label]) => ({
          value,
          label,
        }))}
        onChange={(next) => void setParams({ type: next as FileKind | null })}
      />
      <FilesSearch />
    </div>
  );
}

/** The toolbar's shape while the URL's filters are read. */
export function FilesToolbarSkeleton() {
  return (
    <div
      aria-hidden
      className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-4"
    >
      <Skeleton className="h-8 w-32 rounded-md" />
      <Skeleton className="h-8 w-28 rounded-md" />
      <Skeleton className="h-8 w-24 rounded-md" />
      <Skeleton className="size-8 rounded-md" />
    </div>
  );
}
