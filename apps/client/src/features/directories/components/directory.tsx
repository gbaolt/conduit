'use client';

import { canWorkspace } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@conduit/ui/components/empty';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@conduit/ui/components/tabs';
import { cn } from '@conduit/ui/lib/utils';
import {
  IconAddressBook,
  IconHash,
  IconMailForward,
  IconUser,
  type TablerIcon,
} from '@tabler/icons-react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { PageHeader } from '@/components/page-header';
import { useWorkspaceRole } from '@/services/workspaces/hooks';

/** Tabs, toolbar and results share one gutter, so they share one left and one right edge. */
const column = 'w-full px-4';

/** `adminOnly` tabs show only to people who may invite, as the server lists invitations only to them. */
const TABS: {
  href: Route;
  label: string;
  icon: TablerIcon;
  adminOnly?: boolean;
}[] = [
  { href: '/directories/people', label: 'People', icon: IconUser },
  { href: '/directories/channels', label: 'Channels', icon: IconHash },
  {
    href: '/directories/invitations',
    label: 'Invitations',
    icon: IconMailForward,
    adminOnly: true,
  },
];

export function Directory({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col">{children}</div>;
}

/** The page title. `children` sit at the end, such as the tab's main action. */
export function DirectoryHeader({ children }: { children?: ReactNode }) {
  return (
    <PageHeader icon={IconAddressBook} title="Directories">
      {children}
    </PageHeader>
  );
}

/** A tab per directory. Each is its own route, so a tab keeps its own filters in the URL. */
export function DirectoryTabs() {
  const pathname = usePathname();
  const canInvite = canWorkspace('invite', useWorkspaceRole());
  const tabs = TABS.filter((tab) => canInvite || !tab.adminOnly);

  return (
    <div className="shrink-0 border-b">
      <Tabs value={pathname} className={column}>
        <TabsList variant="line" aria-label="Directories">
          {tabs.map(({ href, label, icon: Icon }) => (
            <TabsTrigger
              key={href}
              value={href}
              nativeButton={false}
              render={<Link href={href} />}
              className="h-full flex-none translate-y-1 px-2 after:bottom-0!"
            >
              <Icon data-icon="inline-start" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

/** The search, the filters, a result count, and the sort at the far end. */
export function DirectoryToolbar({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(column, 'flex shrink-0 flex-wrap items-center gap-2 py-4')}
    >
      {children}
    </div>
  );
}

/** The count and the sort, kept together at the end of the toolbar, even when the toolbar wraps. */
export function DirectoryToolbarEnd({ children }: { children: ReactNode }) {
  return <div className="ml-auto flex items-center gap-2">{children}</div>;
}

/** "12 people". */
export function DirectoryCount({
  count,
  one,
  many,
}: {
  count: number;
  one: string;
  many: string;
}) {
  return (
    <p
      aria-live="polite"
      className="text-muted-foreground text-xs tabular-nums"
    >
      {count} {count === 1 ? one : many}
    </p>
  );
}

/** The scrolling results. Its column stretches, so an empty state centres in it. */
export function DirectoryResults({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-8">
      <div className={cn(column, 'flex flex-1 flex-col')}>{children}</div>
    </div>
  );
}

const listVariants = cva('overflow-hidden rounded-lg', {
  variants: {
    variant: {
      default: 'space-y-2',
      compact: 'divide-y border border-border',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

/** Rows in one bordered box, split by lines, as the Channels and Invitations tabs show them. */
export function DirectoryList({
  label,
  children,
  variant = 'default',
  className,
}: {
  label: string;
  className?: string;
  children: ReactNode;
} & VariantProps<typeof listVariants>) {
  return (
    <ul aria-label={label} className={cn(listVariants({ variant, className }))}>
      {children}
    </ul>
  );
}

export function DirectoryListSkeleton({
  label,
  variant = 'default',
  className,
}: { label: string; className?: string } & VariantProps<typeof listVariants>) {
  return (
    <ul
      role="status"
      aria-label={label}
      className={cn(listVariants({ variant, className }))}
    >
      {variant === 'compact'
        ? ['w-28', 'w-40', 'w-24', 'w-36'].map((width) => (
            <li key={width} className="space-y-2.5 px-4 py-3">
              <Skeleton className={cn('h-4', width)} />
              <Skeleton className="h-3 w-3/5" />
            </li>
          ))
        : ['w-28', 'w-40', 'w-24', 'w-36'].map((width) => (
            <li
              key={width}
              className="border-border flex items-center gap-4 rounded-lg border px-4 py-3"
            >
              <Skeleton className="size-5 rounded-full" />
              <div className="space-y-2">
                <Skeleton className={cn('h-5', width)} />
                <Skeleton className="h-4 w-4/5" />
              </div>
              <Skeleton className="ml-auto h-8 w-16 rounded-md" />
            </li>
          ))}
    </ul>
  );
}

/** A centred empty, no-results or error state: a glyph, a title, a sentence, and at most one action. */
export function DirectoryEmpty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: TablerIcon;
  title: string;
  description: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && (
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
