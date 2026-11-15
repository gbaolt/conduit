import { cn } from '@conduit/ui/lib/utils';
import * as React from 'react';

/** Each part's classes, for a table that React does not render, such as the composer editor's. */
const tableClassNames = {
  container: 'relative w-full overflow-x-auto',
  table: 'w-full caption-bottom text-sm',
  header: '[&_tr]:border-b',
  body: '[&_tr:last-child]:border-0',
  footer: 'bg-muted/50 border-t font-medium [&>tr]:last:border-b-0',
  row: 'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors',
  head: 'text-muted-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0',
  cell: 'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0',
  caption: 'text-muted-foreground mt-4 text-sm',
};

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div data-slot="table-container" className={tableClassNames.container}>
      <table
        data-slot="table"
        className={cn(tableClassNames.table, className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn(tableClassNames.header, className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn(tableClassNames.body, className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(tableClassNames.footer, className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(tableClassNames.row, className)}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(tableClassNames.head, className)}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(tableClassNames.cell, className)}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn(tableClassNames.caption, className)}
      {...props}
    />
  );
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  tableClassNames,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
