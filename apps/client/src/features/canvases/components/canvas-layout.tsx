import { cn } from '@conduit/ui/lib/utils';
import type { ComponentProps } from 'react';

/**
 * The scrolling area of a canvas. Once the card fits the document and an outline in each margin (60rem), it is a
 * grid of three columns: an aside for the outline, the document, and an empty margin. A narrower card shows the
 * document alone.
 */
export function CanvasLayout({
  className,
  fullWidth = false,
  ...props
}: ComponentProps<'div'> & { fullWidth?: boolean }) {
  return (
    <div
      data-slot="canvas-layout"
      className="@container min-h-0 flex-1 overflow-y-auto"
    >
      <div
        className={cn(
          'grid grid-cols-1',
          fullWidth
            ? '[--canvas-content:100%] @min-[60rem]:grid-cols-[minmax(2rem,4.5rem)_minmax(56rem,1fr)_2rem]'
            : '[--canvas-content:56rem] @min-[60rem]:grid-cols-[minmax(0,1fr)_var(--canvas-content)_minmax(0,1fr)]',
          className
        )}
        {...props}
      />
    </div>
  );
}

export function CanvasLayoutContent({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      data-slot="canvas-layout-content"
      className={cn(
        'mx-auto w-full max-w-(--canvas-content) px-2 py-6 sm:px-6 @min-[60rem]:col-start-2',
        className
      )}
      {...props}
    />
  );
}

export function CanvasLayoutAside({
  className,
  ...props
}: ComponentProps<'aside'>) {
  return (
    <aside
      data-slot="canvas-layout-aside"
      className={cn('hidden @min-[60rem]:block', className)}
      {...props}
    />
  );
}
