import { cn } from '@conduit/ui/lib/utils';
import type { TablerIcon } from '@tabler/icons-react';
import type { ReactNode } from 'react';

import { ListBackLink } from '@/components/list-view';

/** The title bar of a sidebar page, such as Threads or Saved. `children` sit at the end, such as the page's main action. */
export function PageHeader({
  icon: Icon,
  title,
  className,
  children,
}: {
  icon: TablerIcon;
  title: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <header
      className={cn(
        'flex min-h-14 shrink-0 items-center gap-2 px-4',
        className
      )}
    >
      <ListBackLink />
      <Icon className="size-4" aria-hidden />
      <h1 className="text-xl/none font-semibold">{title}</h1>
      {children && <div className="ml-auto flex items-center">{children}</div>}
    </header>
  );
}
