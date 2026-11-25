import { CANVAS_UNTITLED } from '@conduit/contract';

const ILLEGAL_FILENAME_CHARS = /[<>:"/\\|?*\p{Cc}]+/gu;

/** Turns a canvas title into a safe `.md` filename. */
export function markdownFilenameOf(title: string): string {
  const cleaned = title
    .replace(ILLEGAL_FILENAME_CHARS, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.-]+|[\s.-]+$/g, '');
  const base = cleaned || CANVAS_UNTITLED;
  return base.toLowerCase().endsWith('.md') ? base : `${base}.md`;
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
