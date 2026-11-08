'use client';

import { cn } from '@conduit/ui/lib/utils';
import { createContext, type ReactNode, use } from 'react';

import { UserAvatar } from '@/components/nav-user';

export type Author = { name: string; image: string | null };

export const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});
const fullFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'full',
  timeStyle: 'medium',
});

/** A grouped row follows one by the same author: it hides the header and shows the time in the gutter. */
const MessageContext = createContext<{
  grouped: boolean;
  createdAt: Date | null;
}>({ grouped: false, createdAt: null });

/** A message in the conversation log: the hover treatment, the mention highlight and the focus tint. */
export function Message({
  label,
  createdAt,
  grouped,
  highlight,
  focused,
  fresh,
  children,
}: {
  label: string;
  createdAt: Date;
  grouped: boolean;
  highlight?: boolean;
  /** Tints the row for 1.5 s after a source link or permalink scrolled to it. */
  focused?: boolean;
  fresh?: boolean;
  children: ReactNode;
}) {
  return (
    <MessageContext value={{ grouped, createdAt }}>
      <article
        aria-label={label}
        data-message-row=""
        data-focused={focused || undefined}
        tabIndex={-1}
        className={cn(
          'group/row hover:bg-muted focus-visible:bg-muted relative flex gap-3 px-5 outline-none',
          grouped ? 'pt-0.5' : 'pt-2',
          highlight &&
            'bg-primary/[0.06] shadow-[inset_2px_0_0_var(--color-primary)]',
          'after:bg-primary/10 after:pointer-events-none after:absolute after:inset-0 after:opacity-0 after:transition-opacity after:duration-1500 data-focused:after:opacity-100 data-focused:after:duration-0 motion-reduce:after:transition-none',
          fresh &&
            'animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:slide-in-from-bottom-0 duration-150 ease-out'
        )}
      >
        {children}
      </article>
    </MessageContext>
  );
}

/** The avatar column. A grouped row shows its time there on hover instead. */
export function MessageAvatar({ author }: { author: Author }) {
  const { grouped, createdAt } = use(MessageContext);

  return (
    <div className="w-9 shrink-0">
      {grouped && createdAt ? (
        <MessageTime
          date={createdAt}
          className="invisible block pt-[5px] text-right text-[11px] group-focus-within/row:visible group-hover/row:visible"
        />
      ) : (
        <UserAvatar
          name={author.name}
          image={author.image}
          className="size-9 rounded-md"
        />
      )}
    </div>
  );
}

/** The column beside the avatar: the header, the body and anything under it. */
export function MessageContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn('min-w-0 flex-1', className)}>{children}</div>;
}

/** The author line. Hidden on a grouped row. */
export function MessageHeader({ children }: { children: ReactNode }) {
  const { grouped } = use(MessageContext);
  if (grouped) return null;

  return <p className="flex items-baseline gap-2">{children}</p>;
}

export function MessageAuthor({ children }: { children: ReactNode }) {
  return (
    <span className="text-foreground text-sm font-semibold">{children}</span>
  );
}

export function MessageTime({
  date,
  format = timeFormat,
  className,
}: {
  date: Date;
  format?: Intl.DateTimeFormat;
  className?: string;
}) {
  return (
    <time
      dateTime={date.toISOString()}
      title={fullFormat.format(date)}
      className={cn('text-muted-foreground tabular-nums', className)}
    >
      {format.format(date)}
    </time>
  );
}
