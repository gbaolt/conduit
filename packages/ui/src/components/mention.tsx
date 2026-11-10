'use client';

import { cn } from '@conduit/ui/lib/utils';
import * as React from 'react';

const EDGE = 8;
const MAX_HEIGHT = 288;

type Placement = {
  above: boolean;
  maxHeight: number;
  shift: number;
  line: number;
};

/**
 * The floating box of a typeahead menu, rendered into the caret line's anchor.
 *
 * Lexical flips its anchor above the caret only when the editor itself has room above the caret, which a
 * one-line composer never has. So the popup sits in a zero-height box that Lexical never flips, and places
 * itself from the room left in the viewport.
 */
function MentionPopup({
  className,
  style,
  ...props
}: React.ComponentProps<'div'>) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = React.useState<Placement>({
    above: false,
    maxHeight: MAX_HEIGHT,
    shift: 0,
    line: 0,
  });

  React.useLayoutEffect(() => {
    const popup = ref.current;
    const anchor = popup?.parentElement?.parentElement;
    if (!popup || !anchor) return;

    const place = () => {
      const line = anchor.getBoundingClientRect();
      const below = window.innerHeight - line.top - EDGE;
      // The caret line ends 3 px above the anchor.
      const above = line.top - line.height - 3 - EDGE;
      const wanted = Math.min(popup.scrollHeight, MAX_HEIGHT);
      const flip = below < wanted && above > below;
      const overflow =
        line.left + popup.offsetWidth - (window.innerWidth - EDGE);
      setPlacement({
        above: flip,
        maxHeight: Math.min(MAX_HEIGHT, flip ? above : below),
        shift: Math.min(Math.max(overflow, 0), Math.max(line.left - EDGE, 0)),
        line: line.height,
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, []);

  return (
    <div className="relative h-0">
      <div
        ref={ref}
        data-slot="mention-popup"
        style={{
          maxHeight: placement.maxHeight,
          left: -placement.shift,
          ...(placement.above ? { bottom: placement.line + 6 } : { top: 0 }),
          ...style,
        }}
        className={cn(
          'bg-popover text-popover-foreground ring-foreground/10 absolute z-50 flex w-72 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-lg shadow-md ring-1',
          className
        )}
        {...props}
      />
    </div>
  );
}

function MentionList({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      role="listbox"
      data-slot="mention-list"
      className={cn('min-h-0 overflow-y-auto p-1', className)}
      {...props}
    />
  );
}

function MentionItem({
  className,
  highlighted = false,
  ...props
}: React.ComponentProps<'li'> & { highlighted?: boolean }) {
  return (
    <li
      role="option"
      aria-selected={highlighted}
      data-slot="mention-item"
      data-highlighted={highlighted || undefined}
      className={cn(
        'data-highlighted:bg-muted flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 text-sm select-none',
        className
      )}
      {...props}
    />
  );
}

/** A round slot for a glyph that stands where an avatar would. */
function MentionItemIcon({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="mention-item-icon"
      className={cn(
        'bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full [&_svg:not([class*=size-])]:size-3.5',
        className
      )}
      {...props}
    />
  );
}

function MentionItemLabel({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="mention-item-label"
      className={cn('min-w-0 truncate font-medium', className)}
      {...props}
    />
  );
}

function MentionItemDescription({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="mention-item-description"
      className={cn(
        'text-muted-foreground ml-auto min-w-0 truncate text-xs',
        className
      )}
      {...props}
    />
  );
}

/**
 * A strip under the list for the highlighted item's full detail. Its height is fixed at three lines, so the
 * popup never resizes as the highlight moves.
 */
function MentionFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="mention-footer"
      className={cn(
        'bg-muted/50 flex shrink-0 flex-col justify-center px-2 py-1.5 text-xs',
        className
      )}
      {...props}
    />
  );
}

function MentionFooterTitle({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="mention-footer-title"
      className={cn('truncate font-medium', className)}
      {...props}
    />
  );
}

function MentionFooterDescription({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="mention-footer-description"
      className={cn(
        'text-muted-foreground line-clamp-2 wrap-anywhere',
        className
      )}
      {...props}
    />
  );
}

export {
  MentionFooter,
  MentionFooterDescription,
  MentionFooterTitle,
  MentionItem,
  MentionItemDescription,
  MentionItemIcon,
  MentionItemLabel,
  MentionList,
  MentionPopup,
};
