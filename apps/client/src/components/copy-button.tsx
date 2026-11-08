'use client';

import { Button } from '@conduit/ui/components/button';
import { cn } from '@conduit/ui/lib/utils';
import { IconCheck, IconCircleX, IconCopy } from '@tabler/icons-react';
import { motion } from 'motion/react';
import type { ComponentProps, ReactNode } from 'react';

import { type CopyState, useCopy } from '@/hooks/use-copy';

import { IconSwap, IconSwapItem } from './icon-swap';

const ANNOUNCEMENTS: Record<CopyState, string> = {
  idle: '',
  done: 'Copied',
  error: 'Copy failed',
};

export type CopyStateIconProps = {
  state: CopyState;
  idleIcon?: ReactNode;
  doneIcon?: ReactNode;
  errorIcon?: ReactNode;
};

export function CopyStateIcon({
  state,
  idleIcon,
  doneIcon,
  errorIcon,
}: CopyStateIconProps) {
  const icons: Record<CopyState, ReactNode> = {
    idle: idleIcon ?? <IconCopy data-slot="idle-icon" />,
    done: doneIcon ?? <IconCheck data-slot="done-icon" />,
    error: errorIcon ?? <IconCircleX data-slot="error-icon" />,
  };

  return (
    <IconSwap>
      <IconSwapItem key={state} as={motion.span}>
        {icons[state]}
      </IconSwapItem>
    </IconSwap>
  );
}

export type CopyButtonProps = ComponentProps<typeof Button> & {
  /** The text to copy, or a function that returns it. */
  text: string | (() => string);
  onCopySuccess?: (text: string) => void;
  onCopyError?: (error: Error) => void;
} & Omit<CopyStateIconProps, 'state'>;

export function CopyButton({
  className,
  size = 'icon',
  children,
  text,
  idleIcon,
  doneIcon,
  errorIcon,
  onClick,
  onCopySuccess,
  onCopyError,
  ...props
}: CopyButtonProps) {
  const { state, copy } = useCopy({ onCopySuccess, onCopyError });

  return (
    <>
      <Button
        className={cn('text-muted-foreground will-change-transform', className)}
        size={size}
        onClick={(event) => {
          copy(text);
          onClick?.(event);
        }}
        aria-label="Copy"
        {...props}
      >
        <CopyStateIcon
          state={state}
          idleIcon={idleIcon}
          doneIcon={doneIcon}
          errorIcon={errorIcon}
        />
        {children}
      </Button>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {ANNOUNCEMENTS[state]}
      </span>
    </>
  );
}
