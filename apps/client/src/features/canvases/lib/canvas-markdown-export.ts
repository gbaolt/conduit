import { CANVAS_UNTITLED } from '@conduit/contract';

const ILLEGAL_FILENAME_CHARS = /[<>:"/\\|?*\p{Cc}]+/gu;
const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])$/i;

/** Turns a canvas title into a safe `.md` filename, avoiding Windows-reserved device names. */
export function markdownFilenameOf(title: string): string {
  const cleaned = title
    .replace(ILLEGAL_FILENAME_CHARS, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.-]+|[\s.-]+$/g, '');
  const base = cleaned || CANVAS_UNTITLED;
  const stem = base.toLowerCase().endsWith('.md') ? base.slice(0, -3) : base;
  const dotIndex = stem.indexOf('.');
  const firstSegment = (
    dotIndex === -1 ? stem : stem.slice(0, dotIndex)
  ).replace(/[\s.]+$/, '');
  const rest = dotIndex === -1 ? '' : stem.slice(dotIndex);
  const safeStem = WINDOWS_RESERVED_NAME.test(firstSegment)
    ? `${firstSegment}-canvas${rest}`
    : stem;
  return `${safeStem}.md`;
}

/** Triggers a browser download of `markdown` as a `.md` file named after `title`. */
export function downloadMarkdownFile(title: string, markdown: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = markdownFilenameOf(title);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
