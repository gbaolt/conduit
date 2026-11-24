import { Suspense } from 'react';

import {
  CanvasViewById,
  CanvasViewSkeleton,
} from '@/features/canvases/components/canvas-view';

export default function CanvasPage({
  params,
}: PageProps<'/canvases/[canvasId]'>) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Suspense fallback={<CanvasViewSkeleton />}>
        <Canvas params={params} />
      </Suspense>
    </div>
  );
}

async function Canvas({
  params,
}: Omit<PageProps<'/canvases/[canvasId]'>, 'searchParams'>) {
  const { canvasId } = await params;
  return <CanvasViewById key={canvasId} canvasId={canvasId} />;
}
