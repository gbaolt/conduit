import {
  CanvasDraftMenuItem,
  CanvasDraftProvider,
} from '@/features/canvases/components/canvas-draft-dialog';
import { SavedMessages } from '@/features/saved/components/saved-messages';
import { ThreadLayout } from '@/features/threads/components/thread-layout';

export default function SavedPage() {
  return (
    <CanvasDraftProvider>
      <ThreadLayout threadMenu={<CanvasDraftMenuItem />}>
        <SavedMessages />
      </ThreadLayout>
    </CanvasDraftProvider>
  );
}
