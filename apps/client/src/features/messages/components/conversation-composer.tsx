'use client';

import { ComposerSkeleton } from '@/components/conversation-skeleton';
import { useComposerActivity, useDraft } from '@/services/activity/hooks';

import { Composer, type ComposerProps } from './composer';

/**
 * The composer for sending to a conversation. It starts from the viewer's saved draft, keeps that draft
 * current as they type, and tells the conversation they are typing. Pass a thread's `parentId` to keep its draft apart. Render it with `key={channelId}`.
 */
export function ConversationComposer({
  channelId,
  parentId,
  ...composer
}: { channelId: string; parentId?: string } & Pick<
  ComposerProps,
  'placeholder' | 'onSubmit' | 'onEditLast' | 'autoFocus' | 'actions'
>) {
  const draft = useDraft(channelId, parentId);
  const onChange = useComposerActivity(channelId, draft ?? '', parentId);

  if (draft === undefined) return <ComposerSkeleton />;

  return <Composer {...composer} initialMarkdown={draft} onChange={onChange} />;
}
