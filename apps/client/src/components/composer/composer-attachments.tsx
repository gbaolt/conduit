'use client';

import {
  Attachment,
  AttachmentError,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentProgress,
  AttachmentRemove,
  Attachments,
} from '@/components/attachment';
import type { Upload } from '@/services/files/upload';

export function ComposerAttachments({
  uploads,
  onRemove,
}: {
  uploads: Upload[];
  onRemove: (localId: string) => void;
}) {
  if (uploads.length === 0) return null;

  return (
    <Attachments className="px-2 pb-2">
      {uploads.map((upload) => (
        <Attachment
          key={upload.localId}
          data={{ ...upload, previewUrl: upload.thumbnailUrl }}
        >
          <AttachmentPreview>
            {upload.status === 'uploading' && (
              <AttachmentProgress progress={upload.progress} />
            )}
          </AttachmentPreview>
          <AttachmentInfo>
            {upload.status === 'failed' && (
              <AttachmentError>{upload.error}</AttachmentError>
            )}
          </AttachmentInfo>
          <AttachmentRemove onClick={() => onRemove(upload.localId)} />
        </Attachment>
      ))}
    </Attachments>
  );
}
