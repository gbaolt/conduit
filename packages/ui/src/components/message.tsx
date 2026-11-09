import { cn } from '@conduit/ui/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

function MessageGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-group"
      className={cn('flex min-w-0 flex-col gap-2', className)}
      {...props}
    />
  );
}

const messageVariants = cva(
  'group/message relative flex w-full min-w-0 text-sm',
  {
    variants: {
      variant: {
        bubble: 'gap-2 data-[align=end]:flex-row-reverse',
        log: [
          'gap-3 outline-none focus-visible:bg-muted',
          '[&[tabindex]]:hover:bg-muted dark:[&[tabindex]]:hover:bg-muted/50',
          'after:pointer-events-none after:absolute after:inset-0 after:bg-primary/10 after:opacity-0 after:transition-opacity after:duration-1500 data-focused:after:opacity-100 data-focused:after:duration-0 motion-reduce:after:transition-none',
        ],
      },
    },
    defaultVariants: {
      variant: 'bubble',
    },
  }
);

function Message({
  className,
  align = 'start',
  variant = 'bubble',
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof messageVariants> & { align?: 'start' | 'end' }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      data-variant={variant}
      className={cn(messageVariants({ variant, className }))}
      {...props}
    />
  );
}

function MessageAvatar({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-avatar"
      className={cn(
        'bg-muted flex w-fit min-w-8 shrink-0 items-center justify-center self-end overflow-hidden rounded-full group-has-data-[slot=message-footer]/message:-translate-y-8',
        'group-data-[variant=log]/message:block group-data-[variant=log]/message:w-9 group-data-[variant=log]/message:self-start group-data-[variant=log]/message:overflow-visible group-data-[variant=log]/message:rounded-none group-data-[variant=log]/message:bg-transparent',
        className
      )}
      {...props}
    />
  );
}

function MessageContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        'flex w-full min-w-0 flex-col gap-2.5 wrap-break-word group-data-[align=end]/message:*:data-slot:self-end',
        'group-data-[variant=log]/message:block',
        className
      )}
      {...props}
    />
  );
}

function MessageHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-header"
      className={cn(
        'text-muted-foreground flex max-w-full min-w-0 items-center px-3 text-xs font-medium group-has-data-[variant=ghost]/message:px-0',
        'group-data-[variant=log]/message:items-baseline group-data-[variant=log]/message:gap-2 group-data-[variant=log]/message:px-0 group-data-[variant=log]/message:text-sm group-data-[variant=log]/message:font-normal',
        className
      )}
      {...props}
    />
  );
}

function MessageFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-footer"
      className={cn(
        'text-muted-foreground flex max-w-full min-w-0 items-center px-3 text-xs font-medium group-has-data-[variant=ghost]/message:px-0 group-data-[align=end]/message:justify-end',
        className
      )}
      {...props}
    />
  );
}

export {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
  messageVariants,
};
