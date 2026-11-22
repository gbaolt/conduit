'use client';

import { MESSAGE_FILES_MAX } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { IconPlus } from '@tabler/icons-react';

import { AttachMenu } from '@/components/attach/attach-menu';
import { Composer, type ComposerProps } from '@/components/composer/composer';
import { ComposerAttachments } from '@/components/composer/composer-attachments';
import { ComposerSkeleton } from '@/components/composer/composer-skeleton';
import { useComposerActivity, useDraft } from '@/services/activity/hooks';
import type { FileUploads } from '@/services/files/upload';

/** Why Send waits: files still uploading, or one that failed and must be removed first. */
function sendBlockedBy({ uploads, uploading }: FileUploads) {
  if (uploading > 0) {
    return `Uploading ${uploading} ${uploading === 1 ? 'file' : 'files'}…`;
  }
  if (uploads.some((upload) => upload.status === 'failed')) {
    return 'Remove the file that failed to send.';
  }
  return undefined;
}

/**
 * The composer for sending to a conversation. It starts from the viewer's saved draft, keeps that draft
 * current as they type, and tells the conversation they are typing. Pass a thread's `parentId` to keep its draft apart. Render it with `key={roomId}`.
 */
export function ConversationComposer({
  roomId,
  parentId,
  uploads,
  ...composer
}: { roomId: string; parentId?: string; uploads: FileUploads } & Pick<
  ComposerProps,
  'placeholder' | 'onSubmit' | 'onEditLast' | 'autoFocus' | 'actions'
>) {
  const draft = useDraft(roomId, parentId);
  const onChange = useComposerActivity(roomId, draft ?? '', parentId);

  if (draft === undefined) return <ComposerSkeleton />;

  return (
    <Composer
      {...composer}
      initialMarkdown={draft}
      onChange={onChange}
      onFiles={uploads.add}
      attach={
        <AttachMenu
          onFiles={uploads.add}
          files={{
            targetRoomId: roomId,
            max:
              MESSAGE_FILES_MAX -
              uploads.uploads.filter((upload) => upload.status !== 'failed')
                .length,
            onInsert: uploads.attach,
          }}
          trigger={
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              className="group text-muted-foreground hover:text-foreground rounded-full"
            >
              <IconPlus className="size-5 transition-[rotate] duration-200 ease-out group-aria-expanded:rotate-135" />
            </Button>
          }
        />
      }
      hasFiles={uploads.ready.length > 0}
      sendBlocked={sendBlockedBy(uploads)}
      attachments={
        <ComposerAttachments
          uploads={uploads.uploads}
          onRemove={uploads.remove}
        />
      }
    />
  );
}
