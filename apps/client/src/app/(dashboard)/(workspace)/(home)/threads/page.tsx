import {
  CanvasDraftMenuItem,
  CanvasDraftProvider,
} from '@/features/canvases/components/canvas-draft-dialog';
import { ThreadList } from '@/features/threads/components/thread-list';

export default function ThreadsPage() {
  return (
    <CanvasDraftProvider>
      <ThreadList threadMenu={<CanvasDraftMenuItem />} />
    </CanvasDraftProvider>
  );
}
