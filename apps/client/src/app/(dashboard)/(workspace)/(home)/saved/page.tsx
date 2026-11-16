import { SavedMessages } from '@/features/messages/components/saved-messages';
import { ThreadLayout } from '@/features/threads/components/thread-layout';

export default function SavedPage() {
  return (
    <ThreadLayout>
      <SavedMessages />
    </ThreadLayout>
  );
}
