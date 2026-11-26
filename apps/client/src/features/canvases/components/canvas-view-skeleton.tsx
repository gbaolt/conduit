import { Skeleton } from '@conduit/ui/components/skeleton';

import { CanvasLayout, CanvasLayoutContent } from './canvas-layout';

const LINE_WIDTHS = ['w-2/3', 'w-full', 'w-5/6', 'w-1/2'];

/** Lines where the document will be, while the editor's code loads. */
export function CanvasViewEditorSkeleton() {
  return (
    <div role="status" aria-label="Loading canvas" className="space-y-4 pl-8">
      {LINE_WIDTHS.map((width) => (
        <Skeleton key={width} className={`h-4 ${width}`} />
      ))}
    </div>
  );
}

export function CanvasViewSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CanvasLayout>
        <CanvasLayoutContent>
          <CanvasViewEditorSkeleton />
        </CanvasLayoutContent>
      </CanvasLayout>
    </div>
  );
}
