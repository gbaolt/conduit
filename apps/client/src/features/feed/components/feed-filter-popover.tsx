'use client';

import { FEED_SOURCES, type FeedSource } from '@conduit/contract';
import { Badge } from '@conduit/ui/components/badge';
import { Button } from '@conduit/ui/components/button';
import { Checkbox } from '@conduit/ui/components/checkbox';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from '@conduit/ui/components/field';
import { Input } from '@conduit/ui/components/input';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@conduit/ui/components/popover';
import { Separator } from '@conduit/ui/components/separator';
import { IconFilter2, IconX } from '@tabler/icons-react';
import { useQueryStates } from 'nuqs';
import { type FormEvent, useId, useState } from 'react';

import { normalizeSources } from '@/services/feed/queries';

import { feedParams } from '../lib/feed-params';
import { FEED_SOURCE_META } from '../lib/feed-sources';
import {
  FEED_VIEW_NAME_MAX,
  type FeedView,
  type FeedViews,
} from '../lib/feed-views';

const defaultName = (sources: readonly FeedSource[]) =>
  sources
    .map((source) => FEED_SOURCE_META[source].label)
    .join(', ')
    .slice(0, FEED_VIEW_NAME_MAX);

function FeedFilterSources({
  picked,
  onPickedChange,
}: {
  picked: readonly FeedSource[];
  onPickedChange: (picked: FeedSource[]) => void;
}) {
  const id = useId();

  return (
    <FieldSet className="gap-0">
      <FieldLegend
        variant="label"
        className="text-muted-foreground px-2 text-xs font-normal"
      >
        Show activity from
      </FieldLegend>
      <FieldGroup
        data-slot="checkbox-group"
        className="data-[slot=checkbox-group]:gap-1"
      >
        {FEED_SOURCES.map((source) => {
          const { label, Icon } = FEED_SOURCE_META[source];
          return (
            <Field
              key={source}
              orientation="horizontal"
              className="hover:bg-muted h-8 gap-2.5 rounded-md px-2"
            >
              <Checkbox
                id={`${id}-${source}`}
                checked={picked.includes(source)}
                onCheckedChange={(checked) =>
                  onPickedChange(
                    checked
                      ? [...picked, source]
                      : picked.filter((s) => s !== source)
                  )
                }
              />
              <FieldLabel
                htmlFor={`${id}-${source}`}
                className="h-full cursor-pointer items-center gap-2 font-normal"
              >
                <Icon className="text-muted-foreground size-4" aria-hidden />
                {label}
              </FieldLabel>
            </Field>
          );
        })}
      </FieldGroup>
    </FieldSet>
  );
}

/** Deletes the custom view that is open, or saves sources that match no view as a new one. */
function FeedFilterPopoverFooter({
  active,
  views,
  picked,
  onDone,
}: {
  active: FeedView | undefined;
  views: FeedViews;
  picked: FeedSource[];
  onDone: () => void;
}) {
  const [, setParams] = useQueryStates(feedParams);
  const [name, setName] = useState('');
  const nameId = useId();

  if (active?.custom) {
    return (
      <Button
        variant="destructive"
        size="sm"
        onClick={() => {
          views.remove(active.id);
          void setParams({ show: null });
          onDone();
        }}
      >
        Delete “{active.name}”
      </Button>
    );
  }
  if (active) {
    return (
      <FieldDescription className="px-2 pb-1 text-xs">
        Tick the sources you want, then save them as a custom view.
      </FieldDescription>
    );
  }

  const create = (event: FormEvent) => {
    event.preventDefault();
    views.create(name.trim() || defaultName(picked), picked);
    onDone();
  };

  return (
    <form onSubmit={create} className="flex flex-col gap-2">
      <Field>
        <FieldLabel htmlFor={nameId} className="sr-only">
          View name
        </FieldLabel>
        <Input
          id={nameId}
          value={name}
          maxLength={FEED_VIEW_NAME_MAX}
          placeholder={defaultName(picked)}
          onChange={(event) => setName(event.target.value)}
          className="h-8"
        />
      </Field>
      <Button type="submit" size="sm">
        Create custom view
      </Button>
    </form>
  );
}

/**
 * The sources filter, which edits `?show=` as boxes are ticked, and the place to save the result as a custom
 * view or delete the custom view that is open. No box ticked shows everything.
 */
export function FeedFilterPopover({
  active,
  views,
}: {
  active: FeedView | undefined;
  views: FeedViews;
}) {
  const [{ show }, setParams] = useQueryStates(feedParams);
  const [open, setOpen] = useState(false);
  const picked = normalizeSources(show);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant={picked.length > 0 && !active ? 'secondary' : 'ghost'}
            size="sm"
          />
        }
      >
        <IconFilter2 data-icon="inline-start" />
        Filter
        {picked.length > 0 && (
          <Badge variant="secondary" className="tabular-nums">
            {picked.length}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <PopoverHeader className="flex-row items-center justify-between pl-2">
          <PopoverTitle>Filter by</PopoverTitle>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Close"
            onClick={() => setOpen(false)}
          >
            <IconX />
          </Button>
        </PopoverHeader>
        <FeedFilterSources
          picked={picked}
          onPickedChange={(next) =>
            void setParams({ show: normalizeSources(next) })
          }
        />
        <FieldSeparator />
        <FeedFilterPopoverFooter
          active={active}
          views={views}
          picked={picked}
          onDone={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
