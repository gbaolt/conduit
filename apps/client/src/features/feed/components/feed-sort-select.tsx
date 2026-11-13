'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@conduit/ui/components/select';

export type FeedSort = 'smart' | 'newest';

const SORTS = [
  { value: 'smart', label: 'Smart' },
  { value: 'newest', label: 'Newest' },
] satisfies { value: FeedSort; label: string }[];

/** Smart puts what needs the member first. Newest keeps the order the items came in. */
export function FeedSortSelect({
  sort,
  onSortChange,
}: {
  sort: FeedSort;
  onSortChange: (sort: FeedSort) => void;
}) {
  return (
    <Select
      items={SORTS}
      value={sort}
      onValueChange={(next) => {
        if (next) onSortChange(next as FeedSort);
      }}
    >
      <SelectTrigger size="sm" aria-label="Sort activity" className="min-w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        {SORTS.map(({ value, label }) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
