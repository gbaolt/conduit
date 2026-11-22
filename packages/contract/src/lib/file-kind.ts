export type FileKind = 'image' | 'video' | 'pdf' | 'text' | 'other';

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

export const FILE_KINDS = ['image', 'video', 'pdf', 'text', 'other'] as const;

/** Every `text/*` type is text, and so are these. */
export const TEXT_CONTENT_PREFIX = 'text/';
export const TEXT_CONTENT_TYPES = [
  'application/json',
  'application/xml',
  'application/csv',
];

const baseType = (contentType: string) =>
  contentType.split(';')[0]!.trim().toLowerCase();

export function fileKind(contentType: string): FileKind {
  const type = baseType(contentType);
  const previewable = PREVIEWABLE[type];
  if (previewable) return previewable;
  if (
    type.startsWith(TEXT_CONTENT_PREFIX) ||
    TEXT_CONTENT_TYPES.includes(type)
  ) {
    return 'text';
  }
  return 'other';
}

/**
 * The exact content types of a kind, for filtering stored files. `text` also takes every type that starts with
 * `TEXT_CONTENT_PREFIX`, and `other` is everything else, so it has none.
 */
export function contentTypesOf(kind: Exclude<FileKind, 'other'>) {
  if (kind === 'text') return TEXT_CONTENT_TYPES;
  return Object.keys(PREVIEWABLE).filter((type) => PREVIEWABLE[type] === kind);
}

/** Every content type with a kind of its own. */
export const PREVIEWABLE_CONTENT_TYPES = Object.keys(PREVIEWABLE);
