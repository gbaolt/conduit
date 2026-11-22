import { formatFileSize } from '@/lib/file-limits';

const MB = 1024 * 1024;

/** How many files one question may carry. */
export const ASK_ATTACHMENTS_MAX = 4;

/** An image reaches the model at up to this size. The composer shrinks a bigger one before it uploads. */
export const ASK_IMAGE_SIZE_MAX = 5 * MB;

/** The longest side the composer shrinks an image to. Vision models scale larger images down anyway. */
export const ASK_IMAGE_SIDE_MAX = 1568;

/** A PDF or text file is read for its text up to this size. */
export const ASK_DOCUMENT_SIZE_MAX = 20 * MB;

/** An image is shown to the model. A document is read for its text. */
export type AskAttachmentKind = 'image' | 'document';

const IMAGES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

export function askAttachmentKind(
  contentType: string
): AskAttachmentKind | null {
  const type = contentType.split(';')[0]!.trim().toLowerCase();
  if (IMAGES.has(type)) return 'image';
  if (
    type === 'application/pdf' ||
    type.startsWith('text/') ||
    /^application\/(json|xml|csv)$/.test(type)
  ) {
    return 'document';
  }
  return null;
}

/** Why Ask Conduit can't read this file, or null when it can. */
export function askAttachmentProblem(contentType: string, size: number) {
  const kind = askAttachmentKind(contentType);
  if (!kind) return 'Ask Conduit reads images, PDFs and text files.';
  const max = kind === 'image' ? ASK_IMAGE_SIZE_MAX : ASK_DOCUMENT_SIZE_MAX;
  if (size > max) {
    return `${kind === 'image' ? 'Images' : 'Files'} can be up to ${formatFileSize(max)} here. This one is ${formatFileSize(size)}.`;
  }
  return null;
}
