import { ResizableHandle } from '@conduit/ui/components/resizable';
import { cn } from '@conduit/ui/lib/utils';
import type { ComponentProps } from 'react';

/** A resize handle that shows a rail on hover, drag, and keyboard focus, so it reads as draggable. */
export function ResizeHandle({
  className,
  ...props
}: ComponentProps<typeof ResizableHandle>) {
  return (
    <ResizableHandle
      className={cn(
        'z-10 after:w-2 focus-visible:ring-0',
        'before:bg-sidebar-ring before:absolute before:inset-y-0 before:left-1/2 before:w-0.5 before:-translate-x-1/2 before:rounded-full before:opacity-0 before:transition-opacity before:duration-150',
        'data-[separator=active]:before:opacity-100 data-[separator=hover]:before:opacity-100',
        className
      )}
      {...props}
    />
  );
}
