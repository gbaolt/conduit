'use client';

import { cn } from '@conduit/ui/lib/utils';
import { IconX } from '@tabler/icons-react';
import * as React from 'react';

/**
 * A short value set as a chip, such as one email in a list of them. With `showCloseButton` it ends in an ✕
 * that calls `onClose`; `closeLabel` names that button for screen readers. `aria-invalid` marks a bad value.
 */
function Tag({
  className,
  children,
  showCloseButton = false,
  onClose,
  closeLabel = 'Remove',
  ...props
}: React.ComponentProps<'span'> & {
  showCloseButton?: boolean;
  onClose?: () => void;
  closeLabel?: string;
}) {
  return (
    <span
      data-slot="tag"
      className={cn(
        'bg-secondary text-secondary-foreground aria-invalid:bg-destructive/10 aria-invalid:text-destructive dark:aria-invalid:bg-destructive/20 animate-in fade-in-0 zoom-in-95 inline-flex h-6 max-w-full min-w-0 shrink-0 items-center gap-1 rounded-sm px-1.5 text-xs font-medium duration-150 ease-out motion-reduce:animate-none',
        showCloseButton && 'pr-0.5',
        className
      )}
      {...props}
    >
      <span data-slot="tag-label" className="truncate">
        {children}
      </span>
      {showCloseButton && (
        <button
          type="button"
          data-slot="tag-close"
          aria-label={closeLabel}
          onClick={onClose}
          className="focus-visible:ring-ring/50 inline-flex size-5 shrink-0 items-center justify-center rounded-[calc(var(--radius-sm)-2px)] opacity-60 transition-[opacity,background-color] duration-150 outline-none hover:bg-black/5 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 active:scale-95 dark:hover:bg-white/10"
        >
          <IconX className="size-3" aria-hidden />
        </button>
      )}
    </span>
  );
}

export { Tag };
