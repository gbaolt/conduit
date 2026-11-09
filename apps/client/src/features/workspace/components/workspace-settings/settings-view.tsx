import { cn } from '@conduit/ui/lib/utils';
import type { ReactNode } from 'react';

import { ListBackLink } from '@/components/list-view';

/** The view's title row: the area's name, one line about its data, and the view's one action. */
export function SettingsHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-8">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <ListBackLink />
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

/** One setting: its name and what it does on the left, the control on the right. */
export function SettingsSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'grid gap-4 border-t py-8 first-of-type:border-t-0 first-of-type:pt-0 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10',
        className
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-base font-medium">
          {title}
        </h2>
        <p className="text-muted-foreground text-sm text-pretty">
          {description}
        </p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** The bordered frame a table or a list of choices sits in. */
export function SettingsPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bg-card rounded-xl border', className)}>{children}</div>
  );
}
