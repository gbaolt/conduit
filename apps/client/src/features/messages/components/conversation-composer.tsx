'use client';

import { useComposerActivity, useDraft } from '@/services/activity/hooks';

import { Composer, type ComposerProps } from './composer';

function DraftLoading() {
  return (
    <div
      aria-hidden
      className="border-input h-[46px] rounded-lg border shadow-[0_1px_3px_rgb(0_0_0/0.08)]"
    />
  );
}

/**
 * The composer for sending to a conversation. It starts from the viewer's saved draft, keeps that draft
 * current as they type, and tells the conversation they are typing. Render it with `key={channelId}`.
 */
export function ConversationComposer({
  channelId,
  ...composer
}: { channelId: string } & Pick<
  ComposerProps,
  'placeholder' | 'onSubmit' | 'onEditLast'
>) {
  const draft = useDraft(channelId);
  const onChange = useComposerActivity(channelId, draft ?? '');

  if (draft === undefined) return <DraftLoading />;

  return <Composer {...composer} initialMarkdown={draft} onChange={onChange} />;
}
