export type FileKind = 'image' | 'video' | 'pdf' | 'other';

/** Types a browser renders in place. SVG stays `other`, so it is never shown inline from storage. */
const PREVIEWABLE: Record<string, FileKind> = {
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/avif': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
  'application/pdf': 'pdf',
};

export const FILE_KINDS = ['image', 'video', 'pdf', 'other'] as const;

export function fileKind(contentType: string): FileKind {
  return (
    PREVIEWABLE[contentType.split(';')[0]!.trim().toLowerCase()] ?? 'other'
  );
}

/** The content types of a kind, for filtering stored files. `other` is everything else, so it has none. */
export function contentTypesOf(kind: Exclude<FileKind, 'other'>) {
  return Object.keys(PREVIEWABLE).filter((type) => PREVIEWABLE[type] === kind);
}

/** Every content type with a kind of its own. */
export const PREVIEWABLE_CONTENT_TYPES = Object.keys(PREVIEWABLE);
