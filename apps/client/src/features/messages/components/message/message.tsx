'use client';

import * as UI from '@conduit/ui/components/message';
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
/** The gutter time drops AM/PM: the group's header above already shows it. */
const gutterFormat = {
  format: (date: Date) =>
    timeFormat
      .formatToParts(date)
      .filter((part) => part.type !== 'dayPeriod')
      .map((part) => part.value)
      .join('')
      .trim(),
};

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
      <UI.Message
        variant="log"
        role="article"
        aria-label={label}
        tabIndex={-1}
        data-highlighted={highlight || undefined}
        data-focused={focused || undefined}
        className={cn(
          'px-5',
          grouped ? 'pt-0.5' : 'pt-2',
          fresh &&
            'animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:slide-in-from-bottom-0 duration-150 ease-out'
        )}
      >
        {children}
      </UI.Message>
    </MessageContext>
  );
}

/** The avatar column. A grouped row shows its time there on hover instead. */
export function MessageAvatar({ author }: { author: Author }) {
  const { grouped, createdAt } = use(MessageContext);

  return (
    <UI.MessageAvatar className="relative">
      {grouped && createdAt ? (
        <MessageTime
          date={createdAt}
          format={gutterFormat}
          className="invisible absolute top-0 right-0 text-[11px] leading-[calc(0.875rem*1.65)] whitespace-nowrap group-focus-within/message:visible group-hover/message:visible"
        />
      ) : (
        <UserAvatar
          name={author.name}
          image={author.image}
          className="size-9 rounded-md"
        />
      )}
    </UI.MessageAvatar>
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
  return (
    <UI.MessageContent className={className}>{children}</UI.MessageContent>
  );
}

/** The author line. Hidden on a grouped row. */
export function MessageHeader({ children }: { children: ReactNode }) {
  const { grouped } = use(MessageContext);
  if (grouped) return null;

  return <UI.MessageHeader>{children}</UI.MessageHeader>;
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
  format?: { format: (date: Date) => string };
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
