'use client';

import {
  ASK_ATTACHMENTS_MAX,
  ASK_IMAGE_SIDE_MAX,
  ASK_IMAGE_SIZE_MAX,
  askAttachmentKind,
  askAttachmentProblem,
} from '@conduit/contract';

import { client } from '@/lib/orpc';
import type { UploadTarget } from '@/services/files/upload';

/** What Ask reads from the Files dialog: no video and no file it can't read. */
export const ASK_FILE_KINDS = ['image', 'pdf', 'text'] as const;

/** What the Ask composer's file picker offers. */
export const ASK_ATTACHMENT_ACCEPT =
  'image/png,image/jpeg,image/gif,image/webp,application/pdf,text/*,.md,.csv,.json,.xml';

/**
 * A picture larger than the model reads, redrawn at `ASK_IMAGE_SIDE_MAX` on its longest side as WebP. A GIF
 * keeps its frames, and a picture the browser can't decode goes as it is, for the server to judge.
 */
async function shrink(file: File): Promise<File> {
  if (askAttachmentKind(file.type) !== 'image' || file.type === 'image/gif') {
    return file;
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const scale = Math.min(
      1,
      ASK_IMAGE_SIDE_MAX / Math.max(bitmap.width, bitmap.height)
    );
    if (scale === 1 && file.size <= ASK_IMAGE_SIZE_MAX) return file;
    const canvas = new OffscreenCanvas(
      Math.round(bitmap.width * scale),
      Math.round(bitmap.height * scale)
    );
    canvas
      .getContext('2d')!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await canvas.convertToBlob({
      type: 'image/webp',
      quality: 0.9,
    });
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', {
      type: 'image/webp',
    });
  } finally {
    bitmap.close();
  }
}

/** An Ask question. Its files belong to the asker, and the server sweeps one never sent. */
export const askUploads: UploadTarget = {
  max: ASK_ATTACHMENTS_MAX,
  prepare: shrink,
  problem: (file) =>
    askAttachmentProblem(file.type || 'application/octet-stream', file.size),
  sign: async (file) => {
    const { attachmentId, uploadUrl } = await client.ask.attachmentUrl(file);
    return { id: attachmentId, uploadUrl };
  },
  complete: (attachmentId, dimensions) =>
    client.ask.completeAttachment({ attachmentId, ...dimensions }),
  attach: (file) => client.ask.attachFile({ fileId: file.id }),
};
