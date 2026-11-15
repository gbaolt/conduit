'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@conduit/ui/components/select';
import { cn } from '@conduit/ui/lib/utils';
import type { TablerIcon } from '@tabler/icons-react';
import { type SingleParserBuilder, useQueryState } from 'nuqs';

/** A literal parser with a default, as `parseAsStringLiteral(['a', 'b']).withDefault('a')` builds. */
export type FilterParser<T extends string> = Omit<
  SingleParserBuilder<T>,
  'parseServerSide'
> & { readonly defaultValue: T };

/**
 * A select whose value lives in the URL under `name`. The trigger always shows the current label, and it
 * fills in while the value differs from the parser's default, so a filtered list says so at a glance.
 * Choosing the default removes the key from the URL.
 */
export function FilterSelect<T extends string>({
  name,
  parser,
  options,
  label,
  icon: Icon,
  align = 'start',
  className,
}: {
  name: string;
  parser: FilterParser<T>;
  /** Every value the parser accepts, with its label, in menu order. */
  options: Record<T, { label: string }>;
  /** The accessible name, such as "Role". */
  label: string;
  icon?: TablerIcon;
  align?: 'start' | 'end';
  className?: string;
}) {
  const [value, setValue] = useQueryState(name, parser);
  const items = (Object.keys(options) as T[]).map((key) => ({
    value: key,
    label: options[key].label,
  }));

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next) void setValue(next as T);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={label}
        data-filtered={value !== parser.defaultValue || undefined}
        className={cn(
          'data-filtered:border-foreground/25 data-filtered:bg-accent dark:data-filtered:bg-accent font-medium',
          className
        )}
      >
        {Icon && <Icon className="text-muted-foreground" />}
        <SelectValue />
      </SelectTrigger>
      <SelectContent align={align}>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
