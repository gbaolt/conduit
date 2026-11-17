'use client';

import type { Room } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { Card } from '@conduit/ui/components/card';
import { DialogContent, DialogHeader } from '@conduit/ui/components/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import { TabsList, TabsTrigger } from '@conduit/ui/components/tabs';
import { cn } from '@conduit/ui/lib/utils';
import { IconChevronDown, IconCopy } from '@tabler/icons-react';
import type { ComponentProps, ReactNode } from 'react';

import { copyText } from '../lib/copy-text';
import { roomDropdownMenuParts, RoomMenuParts } from './room-menu';
import { RoomNotifyMenu, RoomNotifyMenuValue } from './room-notify-menu';
import { RoomStarButton } from './room-star-button';

type DetailsRoom = Pick<Room, 'id' | 'kind' | 'membership'>;

/**
 * The quick controls under a details dialog's title: star, and the notification setting shown on its button.
 * Someone outside the room has neither, so they see nothing.
 */
export function RoomDetailsActions({ room }: { room: DetailsRoom }) {
  if (!room.membership) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <RoomStarButton room={room} variant="outline" />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="aria-expanded:bg-muted"
            />
          }
        >
          <span className="sr-only">Notifications:</span>
          <RoomNotifyMenuValue room={room} />
          <IconChevronDown data-icon="inline-end" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <RoomMenuParts value={roomDropdownMenuParts}>
            <DropdownMenuGroup>
              <RoomNotifyMenu room={room} />
            </DropdownMenuGroup>
          </RoomMenuParts>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** The details dialog's frame: a header, then tabs over a tinted, scrolling body that holds the cards. */
export function RoomDetailsContent({
  className,
  ...props
}: ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      className={cn(
        'top-[min(12svh,6rem)] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg',
        className
      )}
      {...props}
    />
  );
}

export function RoomDetailsHeader({
  className,
  ...props
}: ComponentProps<typeof DialogHeader>) {
  return (
    <DialogHeader
      className={cn('gap-4 px-5 pt-5 pb-3', className)}
      {...props}
    />
  );
}

export function RoomDetailsTabList({
  className,
  ...props
}: ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      variant="line"
      className={cn(
        'w-full justify-start gap-4 rounded-none border-b px-5',
        className
      )}
      {...props}
    />
  );
}

/** A tab of the details dialog, with an optional count after its name, as in "Members 12". */
export function RoomDetailsTab({
  count,
  className,
  children,
  ...props
}: ComponentProps<typeof TabsTrigger> & { count?: number }) {
  return (
    <TabsTrigger className={cn('flex-none px-0', className)} {...props}>
      {children}
      {count !== undefined && (
        <span className="text-muted-foreground font-normal tabular-nums">
          {count}
        </span>
      )}
    </TabsTrigger>
  );
}

export function RoomDetailsBody({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'bg-muted/40 max-h-[min(30.5rem,64svh)] overflow-y-auto p-4',
        className
      )}
      {...props}
    />
  );
}

/** An Edit action at the end of a details row. `label` names what it edits, for screen readers. */
export function RoomDetailsEdit({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="link"
      size="xs"
      className="h-auto px-0"
      aria-label={`Edit ${label.toLowerCase()}`}
      onClick={onClick}
    >
      Edit
    </Button>
  );
}

/** A card of rows in a details dialog; a line divides each row from the next. */
export function RoomDetailsCard({
  className,
  ...props
}: ComponentProps<typeof Card>) {
  return (
    <Card
      size="sm"
      className={cn('divide-border gap-0 divide-y py-0', className)}
      {...props}
    />
  );
}

/** One row of a details card: a title, its value below, and an optional action such as Edit at the end. */
export function RoomDetailsRow({
  title,
  action,
  children,
}: {
  title: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-0.5 px-4 py-3">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The quiet line that closes a details dialog: the room's id, with a button that copies it. */
export function RoomDetailsId({ label, id }: { label: string; id: string }) {
  return (
    <p className="text-muted-foreground flex min-w-0 items-center gap-1 px-1 text-xs">
      <span className="truncate">
        {label}: <span className="tabular-nums select-all">{id}</span>
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Copy ${label.toLowerCase()}`}
        onClick={() => copyText(id)}
      >
        <IconCopy />
      </Button>
    </p>
  );
}
