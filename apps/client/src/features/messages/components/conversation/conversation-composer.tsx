'use client';

import { ConversationComposerSkeleton } from '@/components/conversation-skeleton';
import { useComposerActivity, useDraft } from '@/services/activity/hooks';

import { Composer, type ComposerProps } from '../composer/composer';

/**
 * The composer for sending to a conversation. It starts from the viewer's saved draft, keeps that draft
 * current as they type, and tells the conversation they are typing. Pass a thread's `parentId` to keep its draft apart. Render it with `key={roomId}`.
 */
export function ConversationComposer({
  roomId,
  parentId,
  ...composer
}: { roomId: string; parentId?: string } & Pick<
  ComposerProps,
  'placeholder' | 'onSubmit' | 'onEditLast' | 'autoFocus' | 'actions'
>) {
  const draft = useDraft(roomId, parentId);
  const onChange = useComposerActivity(roomId, draft ?? '', parentId);

  if (draft === undefined) return <ConversationComposerSkeleton />;

  return <Composer {...composer} initialMarkdown={draft} onChange={onChange} />;
}
