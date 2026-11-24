import { IconLayoutBoard } from '@tabler/icons-react';
import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import {
  CanvasList,
  CanvasListNewButton,
  CanvasListSkeleton,
  CanvasListToolbar,
  CanvasListToolbarSkeleton,
} from '@/features/canvases/components/canvas-list';

export default function CanvasesPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader icon={IconLayoutBoard} title="Canvases">
        <CanvasListNewButton />
      </PageHeader>
      <Suspense fallback={<CanvasListToolbarSkeleton />}>
        <CanvasListToolbar />
      </Suspense>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-8">
        <Suspense fallback={<CanvasListSkeleton />}>
          <CanvasList />
        </Suspense>
      </div>
    </div>
  );
}
