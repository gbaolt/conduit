'use client';

import {
  type AskAttachment,
  fileKind,
  type MessageFile,
} from '@conduit/contract';
import { useState } from 'react';

import {
  Attachment,
  AttachmentInfo,
  AttachmentOpen,
  AttachmentPreview,
  Attachments,
} from '@/components/attachment';
import { FileViewer } from '@/components/file-viewer';

const linkOf = (file: MessageFile | AskAttachment) =>
  'url' in file ? file.url : undefined;

/**
 * What a question carried, above its bubble. A picture shows small and opens full size, a PDF opens in the
 * browser's reader, and any other file downloads. While the question is in flight there is no link yet, so each
 * shows by name.
 */
export function AskQuestionAttachments({
  attachments,
}: {
  attachments: readonly (MessageFile | AskAttachment)[];
}) {
  const [opened, setOpened] = useState<AskAttachment | null>(null);
  if (attachments.length === 0) return null;

  return (
    <>
      <Attachments variant="grid" className="max-w-full justify-end self-end">
        {attachments.map((file) => {
          const url = linkOf(file);
          const kind = fileKind(file.contentType);
          const picture = kind === 'image' && url;
          return (
            <Attachment
              key={file.id}
              data={{ ...file, previewUrl: picture ? url : undefined }}
            >
              <AttachmentPreview />
              {!picture && <AttachmentInfo className="pr-6" />}
              {url && (kind === 'image' || kind === 'pdf') && (
                <AttachmentOpen onClick={() => setOpened({ ...file, url })} />
              )}
              {url && kind !== 'image' && kind !== 'pdf' && (
                <AttachmentOpen href={url} />
              )}
            </Attachment>
          );
        })}
      </Attachments>
      <FileViewer
        file={opened}
        url={
          opened
            ? { id: opened.id, viewUrl: opened.url, downloadUrl: opened.url }
            : undefined
        }
        onClose={() => setOpened(null)}
      />
    </>
  );
}
